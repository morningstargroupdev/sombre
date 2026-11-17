use std::collections::BTreeMap;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use ureq::Agent;

use crate::process;

const VERSION: &str = "2025-06-18";
const OPEN: Duration = Duration::from_secs(30);
const CALL: Duration = Duration::from_secs(300);
const LIMIT: usize = 20_000;

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Server {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub args: Vec<String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub env: BTreeMap<String, String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub headers: BTreeMap<String, String>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Tool {
    pub server: String,
    pub name: String,
    pub exposed: String,
    pub about: String,
    pub schema: Value,
}

enum Link {
    Stdio {
        child: Child,
        input: ChildStdin,
        output: Receiver<String>,
    },
    Http {
        url: String,
        headers: BTreeMap<String, String>,
        session: Option<String>,
    },
}

struct Live {
    name: String,
    link: Link,
    next: u64,
}

pub struct Pool {
    live: Vec<Live>,
    pub tools: Vec<Tool>,
    pub problems: Vec<String>,
}

pub fn clean(text: &str) -> String {
    text.chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '_' || character == '-' {
                character
            } else {
                '_'
            }
        })
        .collect()
}

pub fn exposed(server: &str, tool: &str) -> String {
    let name = format!("mcp__{}__{}", clean(server), clean(tool));
    name.chars().take(64).collect()
}

fn text(result: &Value) -> String {
    let joined: Vec<String> = result["content"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|block| match block["type"].as_str() {
            Some("text") => block["text"].as_str().map(str::to_string),
            Some(kind) => Some(format!("[{kind} content]")),
            None => None,
        })
        .collect();
    let body = if joined.is_empty() {
        result
            .get("structuredContent")
            .map(Value::to_string)
            .unwrap_or_default()
    } else {
        joined.join("\n")
    };
    if body.chars().count() > LIMIT {
        format!(
            "{}\n… output cut short",
            body.chars().take(LIMIT).collect::<String>()
        )
    } else {
        body
    }
}

impl Live {
    fn open(name: &str, server: &Server, cwd: &Path) -> Result<Self, String> {
        let link = match (&server.command, &server.url) {
            (Some(command), _) => {
                let program = process::find(command)
                    .map_or_else(|| command.into(), |path| path.into_os_string());
                let mut launch = Command::new(program);
                launch
                    .args(&server.args)
                    .envs(&server.env)
                    .current_dir(cwd)
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::null());
                let mut child = process::group(&mut launch)
                    .spawn()
                    .map_err(|error| format!("couldn't start `{command}`: {error}"))?;
                crate::process::track(child.id());
                let input = child.stdin.take().ok_or("the server has no input")?;
                let stdout = child.stdout.take().ok_or("the server has no output")?;
                let (sender, output) = mpsc::channel();
                thread::spawn(move || {
                    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                        if sender.send(line).is_err() {
                            break;
                        }
                    }
                });
                Link::Stdio {
                    child,
                    input,
                    output,
                }
            }
            (None, Some(url)) => Link::Http {
                headers: server.headers.clone(),
                session: None,
                url: url.clone(),
            },
            (None, None) => return Err("it needs a command or a url".to_string()),
        };
        let mut live = Self {
            link,
            name: name.to_string(),
            next: 1,
        };
        live.request(
            "initialize",
            json!({
                "protocolVersion": VERSION,
                "capabilities": {},
                "clientInfo": {"name": "sombre", "version": env!("CARGO_PKG_VERSION")}
            }),
            OPEN,
        )?;
        live.notify("notifications/initialized");
        Ok(live)
    }

    fn tools(&mut self) -> Result<Vec<Tool>, String> {
        let mut tools = Vec::new();
        let mut cursor: Option<String> = None;
        loop {
            let params = cursor
                .as_ref()
                .map_or_else(|| json!({}), |cursor| json!({"cursor": cursor}));
            let page = self.request("tools/list", params, OPEN)?;
            for tool in page["tools"].as_array().into_iter().flatten() {
                let Some(name) = tool["name"].as_str() else {
                    continue;
                };
                tools.push(Tool {
                    about: tool["description"].as_str().unwrap_or_default().to_string(),
                    exposed: exposed(&self.name, name),
                    name: name.to_string(),
                    schema: if tool["inputSchema"].is_object() {
                        tool["inputSchema"].clone()
                    } else {
                        json!({"type": "object", "properties": {}})
                    },
                    server: self.name.clone(),
                });
            }
            cursor = page["nextCursor"].as_str().map(str::to_string);
            if cursor.is_none() {
                return Ok(tools);
            }
        }
    }

    fn notify(&mut self, method: &str) {
        let message = json!({"jsonrpc": "2.0", "method": method});
        match &mut self.link {
            Link::Stdio { input, .. } => {
                let _ = writeln!(input, "{message}");
                let _ = input.flush();
            }
            Link::Http { .. } => {
                let _ = self.post(&message);
            }
        }
    }

    fn post(&mut self, message: &Value) -> Result<Vec<Value>, String> {
        let Link::Http {
            url,
            headers,
            session,
        } = &mut self.link
        else {
            return Ok(Vec::new());
        };
        let agent: Agent = Agent::config_builder()
            .http_status_as_error(false)
            .timeout_global(Some(CALL))
            .build()
            .into();
        let mut request = agent
            .post(url.as_str())
            .header("Accept", "application/json, text/event-stream")
            .header("MCP-Protocol-Version", VERSION);
        for (name, value) in headers.iter() {
            request = request.header(name, value);
        }
        if let Some(session) = session.as_ref() {
            request = request.header("Mcp-Session-Id", session);
        }
        let mut response = request
            .send_json(message)
            .map_err(|error| format!("couldn't reach it: {error}"))?;
        if let Some(found) = response
            .headers()
            .get("mcp-session-id")
            .and_then(|value| value.to_str().ok())
        {
            *session = Some(found.to_string());
        }
        let status = response.status().as_u16();
        let body = response.body_mut().read_to_string().unwrap_or_default();
        if status == 401 || status == 403 {
            return Err(
                "it needs a login sombre can't do yet. add a token in its headers".to_string(),
            );
        }
        if status >= 400 {
            return Err(format!("it answered {status}"));
        }
        let lines: Vec<Value> = body
            .lines()
            .filter_map(|line| line.strip_prefix("data:").map(str::trim))
            .filter_map(|data| serde_json::from_str(data).ok())
            .collect();
        if lines.is_empty() {
            Ok(serde_json::from_str::<Value>(&body).into_iter().collect())
        } else {
            Ok(lines)
        }
    }

    fn request(&mut self, method: &str, params: Value, wait: Duration) -> Result<Value, String> {
        let id = self.next;
        self.next += 1;
        let message = json!({"jsonrpc": "2.0", "id": id, "method": method, "params": params});
        let answer = match &mut self.link {
            Link::Stdio { input, output, .. } => {
                writeln!(input, "{message}").map_err(|error| format!("it stopped: {error}"))?;
                input
                    .flush()
                    .map_err(|error| format!("it stopped: {error}"))?;
                let deadline = Instant::now() + wait;
                loop {
                    let left = deadline.saturating_duration_since(Instant::now());
                    let line = match output.recv_timeout(left) {
                        Ok(line) => line,
                        Err(RecvTimeoutError::Timeout) => {
                            return Err(format!("no answer to {method} after {}s", wait.as_secs()));
                        }
                        Err(RecvTimeoutError::Disconnected) => return Err("it exited".to_string()),
                    };
                    let Ok(reply) = serde_json::from_str::<Value>(&line) else {
                        continue;
                    };
                    if reply["id"] == id && reply.get("method").is_none() {
                        break reply;
                    }
                    if let (Some(asked), Some(method)) = (reply.get("id"), reply["method"].as_str())
                    {
                        let back = if method == "ping" {
                            json!({"jsonrpc": "2.0", "id": asked, "result": {}})
                        } else {
                            json!({"jsonrpc": "2.0", "id": asked, "error": {"code": -32601, "message": "not supported"}})
                        };
                        let _ = writeln!(input, "{back}");
                        let _ = input.flush();
                    }
                }
            }
            Link::Http { .. } => self
                .post(&message)?
                .into_iter()
                .find(|reply| reply["id"] == id)
                .ok_or_else(|| format!("no answer to {method}"))?,
        };
        if let Some(problem) = answer.get("error") {
            return Err(problem["message"]
                .as_str()
                .unwrap_or("it returned an error")
                .to_string());
        }
        Ok(answer["result"].clone())
    }
}

impl Pool {
    pub fn start(servers: &BTreeMap<String, Server>, cwd: &Path) -> Self {
        let mut pool = Self {
            live: Vec::new(),
            problems: Vec::new(),
            tools: Vec::new(),
        };
        for (name, server) in servers {
            match Live::open(name, server, cwd)
                .and_then(|mut live| live.tools().map(|tools| (live, tools)))
            {
                Ok((live, tools)) => {
                    pool.tools.extend(tools);
                    pool.live.push(live);
                }
                Err(problem) => pool.problems.push(format!("mcp server {name}: {problem}")),
            }
        }
        pool
    }

    pub fn schema(&self) -> Vec<Value> {
        self.tools
            .iter()
            .map(|tool| {
                json!({"type": "function", "function": {
                    "name": tool.exposed,
                    "description": format!("{} (from the {} mcp server)", tool.about, tool.server),
                    "parameters": tool.schema,
                }})
            })
            .collect()
    }

    pub fn find(&self, exposed: &str) -> Option<&Tool> {
        self.tools.iter().find(|tool| tool.exposed == exposed)
    }

    pub fn call(&mut self, exposed: &str, input: &Value) -> Result<String, String> {
        let tool = self
            .find(exposed)
            .cloned()
            .ok_or_else(|| format!("there is no mcp tool called {exposed}"))?;
        let live = self
            .live
            .iter_mut()
            .find(|live| live.name == tool.server)
            .ok_or_else(|| format!("the {} mcp server isn't running", tool.server))?;
        let result = live.request(
            "tools/call",
            json!({"name": tool.name, "arguments": input}),
            CALL,
        )?;
        let body = text(&result);
        if result["isError"] == true {
            Err(body)
        } else {
            Ok(body)
        }
    }
}

fn strings(value: &Value) -> Vec<String> {
    value
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|item| item.as_str().map(str::to_string))
        .collect()
}

fn table(value: &Value) -> BTreeMap<String, String> {
    value
        .as_object()
        .into_iter()
        .flatten()
        .filter_map(|(key, item)| item.as_str().map(|item| (key.clone(), item.to_string())))
        .collect()
}

pub fn claude(text: &str) -> Vec<(String, Server)> {
    let Ok(config) = serde_json::from_str::<Value>(text) else {
        return Vec::new();
    };
    config["mcpServers"]
        .as_object()
        .into_iter()
        .flatten()
        .map(|(name, entry)| {
            (
                name.clone(),
                Server {
                    args: strings(&entry["args"]),
                    command: entry["command"].as_str().map(str::to_string),
                    env: table(&entry["env"]),
                    headers: table(&entry["headers"]),
                    url: entry["url"].as_str().map(str::to_string),
                },
            )
        })
        .collect()
}

pub fn codex(text: &str) -> Vec<(String, Server)> {
    let Ok(config) = toml::from_str::<toml::Table>(text) else {
        return Vec::new();
    };
    let Ok(config) = serde_json::to_value(config) else {
        return Vec::new();
    };
    config["mcp_servers"]
        .as_object()
        .into_iter()
        .flatten()
        .map(|(name, entry)| {
            (
                name.clone(),
                Server {
                    args: strings(&entry["args"]),
                    command: entry["command"].as_str().map(str::to_string),
                    env: table(&entry["env"]),
                    headers: table(&entry["http_headers"]),
                    url: entry["url"].as_str().map(str::to_string),
                },
            )
        })
        .collect()
}

pub fn foreign() -> Vec<(&'static str, String, Server)> {
    let Some(home) = process::home() else {
        return Vec::new();
    };
    let codex_home = std::env::var_os("CODEX_HOME")
        .map_or_else(|| home.join(".codex"), std::path::PathBuf::from);
    let mut found: Vec<(&'static str, String, Server)> = Vec::new();
    for (name, server) in
        claude(&std::fs::read_to_string(home.join(".claude.json")).unwrap_or_default())
    {
        found.push(("claude code", name, server));
    }
    for (name, server) in
        codex(&std::fs::read_to_string(codex_home.join("config.toml")).unwrap_or_default())
    {
        if !found.iter().any(|(_, other, _)| *other == name) {
            found.push(("codex", name, server));
        }
    }
    found
        .into_iter()
        .filter(|(_, _, server)| server.command.is_some() || server.url.is_some())
        .collect()
}

impl Drop for Pool {
    fn drop(&mut self) {
        for live in &mut self.live {
            if let Link::Stdio { child, .. } = &mut live.link {
                process::kill(child.id());
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_safe_unique_tool_names() {
        assert_eq!(
            exposed("github", "create_issue"),
            "mcp__github__create_issue"
        );
        assert_eq!(exposed("my server", "do.thing"), "mcp__my_server__do_thing");
        assert_eq!(exposed(&"s".repeat(80), "t").chars().count(), 64);
    }

    #[test]
    fn reads_text_and_marks_other_content() {
        let result =
            json!({"content": [{"type": "text", "text": "hi"}, {"type": "image", "data": "x"}]});
        assert_eq!(text(&result), "hi\n[image content]");
        assert_eq!(
            text(&json!({"content": [], "structuredContent": {"a": 1}})),
            "{\"a\":1}"
        );
    }

    #[cfg(unix)]
    #[test]
    fn talks_to_a_stdio_server() {
        let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        let script = dir.path().join("fake.sh");
        std::fs::write(
            &script,
            r#"while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
  case "$line" in
    *'"initialize"'*) printf '{"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}}}}\n' "$id" ;;
    *'"tools/list"'*) printf '{"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"echo","description":"Echo text","inputSchema":{"type":"object","properties":{"text":{"type":"string"}}}}]}}\n' "$id" ;;
    *'"tools/call"'*) printf '{"jsonrpc":"2.0","method":"notifications/message","params":{}}\n{"jsonrpc":"2.0","id":99,"method":"ping"}\n{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"echoed"}]}}\n' "$id" ;;
  esac
done
"#,
        )
        .unwrap_or_else(|error| panic!("{error}"));
        let servers = BTreeMap::from([(
            "fake".to_string(),
            Server {
                args: vec![script.display().to_string()],
                command: Some("sh".to_string()),
                ..Server::default()
            },
        )]);
        let mut pool = Pool::start(&servers, dir.path());
        assert!(pool.problems.is_empty(), "{:?}", pool.problems);
        assert_eq!(pool.tools.len(), 1);
        assert_eq!(pool.schema()[0]["function"]["name"], "mcp__fake__echo");
        assert_eq!(
            pool.call("mcp__fake__echo", &json!({"text": "x"})),
            Ok("echoed".to_string())
        );
        assert!(pool.call("mcp__fake__missing", &json!({})).is_err());
    }

    #[test]
    fn reads_servers_from_claude_and_codex_configs() {
        let found = claude(
            r#"{"mcpServers": {"ssh": {"type": "stdio", "command": "npx", "args": ["-y", "ssh-mcp"], "env": {"A": "1"}}, "docs": {"type": "http", "url": "https://x.dev/mcp", "headers": {"Authorization": "Bearer t"}}}}"#,
        );
        assert_eq!(found.len(), 2);
        assert_eq!(found[1].0, "ssh");
        assert_eq!(found[1].1.command.as_deref(), Some("npx"));
        assert_eq!(found[1].1.args, ["-y", "ssh-mcp"]);
        assert_eq!(found[0].1.url.as_deref(), Some("https://x.dev/mcp"));
        let codex = codex(
            "model = \"x\"\n[mcp_servers.repl]\ncommand = \"node\"\nargs = [\"repl.js\"]\n[mcp_servers.repl.env]\nNODE_ENV = \"production\"\n",
        );
        assert_eq!(codex.len(), 1);
        assert_eq!(
            codex[0].1.env.get("NODE_ENV").map(String::as_str),
            Some("production")
        );
        assert!(claude("not json").is_empty());
    }

    #[test]
    fn reports_servers_that_fail_to_start() {
        let servers = BTreeMap::from([
            ("broken".to_string(), Server::default()),
            (
                "missing".to_string(),
                Server {
                    command: Some("sombre-no-such-server".to_string()),
                    ..Server::default()
                },
            ),
        ]);
        let pool = Pool::start(&servers, Path::new("."));
        assert_eq!(pool.problems.len(), 2);
        assert!(pool.tools.is_empty());
    }
}
