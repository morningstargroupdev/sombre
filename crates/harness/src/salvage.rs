use serde_json::{Map, Value, json};

fn plain(name: &str) -> String {
    name.chars()
        .filter(char::is_ascii_alphanumeric)
        .collect::<String>()
        .to_lowercase()
}

fn resolve(name: &str, known: &[String]) -> Option<String> {
    let name = name.trim();
    known
        .iter()
        .find(|tool| *tool == name)
        .or_else(|| known.iter().find(|tool| plain(tool) == plain(name)))
        .cloned()
}

fn value(text: &str) -> Value {
    let text = text.trim();
    serde_json::from_str(text).unwrap_or_else(|_| Value::String(text.to_string()))
}

fn xml(text: &str, known: &[String]) -> Vec<(String, Value)> {
    let mut calls = Vec::new();
    let mut rest = text;
    while let Some(start) = rest.find("<function=") {
        let after = &rest[start + 10..];
        let Some(close) = after.find('>') else {
            break;
        };
        let name = &after[..close];
        let body_start = close + 1;
        let end = after.find("</function>").unwrap_or(after.len());
        let body = &after[body_start..end.max(body_start)];
        let mut arguments = Map::new();
        let mut inner = body;
        while let Some(open) = inner.find("<parameter=") {
            let tail = &inner[open + 11..];
            let Some(close) = tail.find('>') else {
                break;
            };
            let key = tail[..close].trim().to_string();
            let content = &tail[close + 1..];
            let stop = content.find("</parameter>").unwrap_or(content.len());
            arguments.insert(key, value(&content[..stop]));
            inner = &content[stop..];
        }
        if let Some(tool) = resolve(name, known) {
            calls.push((tool, Value::Object(arguments)));
        }
        rest = &after[end.min(after.len())..];
    }
    calls
}

fn hermes(text: &str, known: &[String]) -> Vec<(String, Value)> {
    text.split("<tool_call>")
        .skip(1)
        .filter_map(|chunk| {
            let body = chunk.split("</tool_call>").next()?.trim();
            let call: Value = serde_json::from_str(body).ok()?;
            let tool = resolve(call["name"].as_str()?, known)?;
            let arguments = match &call["arguments"] {
                Value::String(text) => serde_json::from_str(text).unwrap_or(Value::Null),
                other => other.clone(),
            };
            Some((tool, arguments))
        })
        .collect()
}

pub fn calls(text: &str, known: &[String]) -> Vec<(String, Value)> {
    let found = xml(text, known);
    if found.is_empty() {
        hermes(text, known)
    } else {
        found
    }
}

pub fn strip(text: &str) -> String {
    let mut kept = text.to_string();
    for (open, close) in [
        ("<tool_call>", "</tool_call>"),
        ("<function=", "</function>"),
    ] {
        while let Some(start) = kept.find(open) {
            let end = kept[start..]
                .find(close)
                .map_or(kept.len(), |offset| start + offset + close.len());
            kept.replace_range(start..end, "");
        }
    }
    kept.trim().to_string()
}

pub fn repair(message: &mut Value, known: &[String]) -> bool {
    if message["tool_calls"]
        .as_array()
        .is_some_and(|calls| !calls.is_empty())
    {
        return false;
    }
    let Some(text) = message["content"].as_str().map(str::to_string) else {
        return false;
    };
    let found = calls(&text, known);
    if found.is_empty() {
        return false;
    }
    message["tool_calls"] = Value::Array(
        found
            .into_iter()
            .enumerate()
            .map(|(index, (name, arguments))| {
                json!({
                    "id": format!("text_{index}_{}", crate::run::stamp()),
                    "type": "function",
                    "function": {"name": name, "arguments": arguments.to_string()}
                })
            })
            .collect(),
    );
    let kept = strip(&text);
    message["content"] = if kept.is_empty() {
        Value::Null
    } else {
        Value::String(kept)
    };
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn known() -> Vec<String> {
        vec!["mcp__everything__echo".to_string(), "read".to_string()]
    }

    #[test]
    fn reads_qwen_style_calls_and_fixes_mangled_names() {
        let text = "I'll echo it.\n<tool_call>\n<function=mcpeverythingecho>\n<parameter=message>\nsombre works\n</parameter>\n</function>\n</tool_call>";
        assert_eq!(
            calls(text, &known()),
            vec![(
                "mcp__everything__echo".to_string(),
                json!({"message": "sombre works"})
            )]
        );
        assert_eq!(strip(text), "I'll echo it.");
    }

    #[test]
    fn reads_hermes_style_calls() {
        let text = "<tool_call>{\"name\": \"read\", \"arguments\": {\"path\": \"a.txt\", \"limit\": 5}}</tool_call>";
        assert_eq!(
            calls(text, &known()),
            vec![("read".to_string(), json!({"path": "a.txt", "limit": 5}))]
        );
    }

    #[test]
    fn ignores_unknown_tools_and_plain_text() {
        assert!(calls("<function=launch_rockets>\n</function>", &known()).is_empty());
        assert!(calls("no tools here", &known()).is_empty());
    }

    #[test]
    fn repairs_a_reply_without_real_tool_calls() {
        let mut message = json!({"role": "assistant", "content": "<function=read><parameter=path>a.txt</parameter></function>"});
        assert!(repair(&mut message, &known()));
        assert_eq!(message["tool_calls"][0]["function"]["name"], "read");
        assert_eq!(
            message["tool_calls"][0]["function"]["arguments"],
            "{\"path\":\"a.txt\"}"
        );
        assert!(message["content"].is_null());
        let mut fine = json!({"role": "assistant", "content": "hi", "tool_calls": [{"id": "1"}]});
        assert!(!repair(&mut fine, &known()));
    }
}
