use serde::{Deserialize, Serialize};

pub const CAP: usize = 2_000;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Item {
    Prompt {
        text: String,
    },
    Reply {
        text: String,
    },
    Tool {
        label: String,
        detail: String,
        output: String,
    },
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Turn {
    User(String),
    Agent(String),
}

pub fn cap(text: &str) -> String {
    let count = text.chars().count();
    if count <= CAP {
        return text.trim_end().to_string();
    }
    let kept: String = text.chars().take(CAP).collect();
    format!("{}\n… {} more characters", kept.trim_end(), count - CAP)
}

fn tool(label: &str, detail: &str, output: &str) -> String {
    let head = match label {
        "Run" => format!("ran `{detail}`"),
        "Edit" => format!("edited `{detail}`"),
        other => format!("{} `{detail}`", other.to_lowercase()),
    };
    if output.trim().is_empty() {
        head
    } else {
        format!("{head}\n```\n{}\n```", cap(output))
    }
}

pub fn turns(items: &[Item]) -> Vec<Turn> {
    let mut turns: Vec<Turn> = Vec::new();
    for item in items {
        let (user, text) = match item {
            Item::Prompt { text } => (true, text.trim().to_string()),
            Item::Reply { text } => (false, text.trim().to_string()),
            Item::Tool {
                label,
                detail,
                output,
            } => (false, tool(label, detail, output)),
        };
        if text.is_empty() {
            continue;
        }
        match (turns.last_mut(), user) {
            (Some(Turn::User(last)), true) | (Some(Turn::Agent(last)), false) => {
                last.push_str("\n\n");
                last.push_str(&text);
            }
            (_, true) => turns.push(Turn::User(text)),
            (_, false) => turns.push(Turn::Agent(text)),
        }
    }
    turns
}

#[cfg(test)]
mod tests {
    use super::*;

    fn prompt(text: &str) -> Item {
        Item::Prompt {
            text: text.to_string(),
        }
    }

    fn reply(text: &str) -> Item {
        Item::Reply {
            text: text.to_string(),
        }
    }

    #[test]
    fn groups_items_into_alternating_turns() {
        let items = [
            prompt("fix the test"),
            reply("looking"),
            Item::Tool {
                detail: "bun test".to_string(),
                label: "Run".to_string(),
                output: "1 fail".to_string(),
            },
            Item::Tool {
                detail: "src/a.ts".to_string(),
                label: "Edit".to_string(),
                output: String::new(),
            },
            reply("fixed"),
            prompt("thanks"),
            prompt("also lint"),
        ];
        assert_eq!(
            turns(&items),
            vec![
                Turn::User("fix the test".to_string()),
                Turn::Agent(
                    "looking\n\nran `bun test`\n```\n1 fail\n```\n\nedited `src/a.ts`\n\nfixed"
                        .to_string()
                ),
                Turn::User("thanks\n\nalso lint".to_string()),
            ]
        );
    }

    #[test]
    fn skips_empty_items() {
        assert_eq!(turns(&[reply("  "), prompt("")]), Vec::<Turn>::new());
    }

    #[test]
    fn caps_long_tool_output() {
        let long = "x".repeat(CAP + 5);
        assert!(cap(&long).ends_with("… 5 more characters"));
        assert_eq!(cap("short\n"), "short");
    }
}
