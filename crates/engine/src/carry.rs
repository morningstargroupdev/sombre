use std::path::Path;
use std::process::{Command, Stdio};

use sombre_core::handoff::{self, Moved, Versions};
use sombre_core::{Agent, Event, Roots, Session, transcript};
use sombre_harness::process;

pub fn installed(program: &str) -> Option<String> {
    process::find(program)
        .and_then(|path| {
            Command::new(path)
                .arg("--version")
                .stdin(Stdio::null())
                .stderr(Stdio::null())
                .output()
                .ok()
        })
        .map(|output| String::from_utf8_lossy(&output.stdout).to_string())
        .and_then(|text| {
            text.split_whitespace()
                .find(|word| {
                    word.chars()
                        .next()
                        .is_some_and(|first| first.is_ascii_digit())
                })
                .map(str::to_string)
        })
}

fn version(program: &str) -> String {
    installed(program).unwrap_or_else(|| "0.0.0".to_string())
}

fn shelf(away: bool, id: &str) -> Result<(), String> {
    let program = process::find("codex").ok_or("codex isn't installed")?;
    let output = Command::new(program)
        .args([if away { "archive" } else { "unarchive" }, id])
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("couldn't run codex: {error}"))?;
    if output.status.success() {
        Ok(())
    } else {
        let said = String::from_utf8_lossy(&output.stderr);
        Err(format!(
            "codex couldn't {} the chat: {}",
            if away { "archive" } else { "unarchive" },
            said.trim().lines().last().unwrap_or("no reason given")
        ))
    }
}

pub fn run(
    roots: &Roots,
    from: Agent,
    session: &str,
    to: Agent,
    cwd: &Path,
) -> Result<(Moved, Vec<Event>), String> {
    let versions = Versions {
        claude: if to == Agent::Claude {
            version("claude")
        } else {
            String::new()
        },
        listed: sombre_harness::config::Config::load(&roots.sombre)
            .is_ok_and(|config| config.publish),
        codex: if to == Agent::Codex {
            version("codex")
        } else {
            String::new()
        },
    };
    let moved = handoff::hand(roots, from, session, to, cwd, &versions, &shelf)?;
    let opened = Session {
        agent: to,
        cwd: cwd.to_path_buf(),
        id: moved.session.clone(),
        path: moved.path.clone(),
        title: String::new(),
        updated: 0,
    };
    let history = transcript(&opened);
    Ok((moved, history))
}

pub fn note(to: Agent, carried: usize) -> String {
    let count = if carried == 1 {
        "1 message".to_string()
    } else {
        format!("{carried} messages")
    };
    let came = if carried == 0 {
        "it was already up to date".to_string()
    } else {
        format!("{count} came along")
    };
    match to {
        Agent::Claude => format!("moved to claude code. {came}. `claude --resume` lists it too"),
        Agent::Codex => format!("moved to codex. {came}. `codex resume` lists it too"),
        Agent::Sombre => format!("moved to sombre's agent. {came}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn says_what_moved_and_where_to_find_it() {
        assert_eq!(
            note(Agent::Codex, 4),
            "moved to codex. 4 messages came along. `codex resume` lists it too"
        );
        assert_eq!(
            note(Agent::Claude, 1),
            "moved to claude code. 1 message came along. `claude --resume` lists it too"
        );
        assert_eq!(
            note(Agent::Sombre, 0),
            "moved to sombre's agent. it was already up to date"
        );
    }
}
