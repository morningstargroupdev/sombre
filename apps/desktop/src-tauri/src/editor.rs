use std::path::Path;
use std::process::{Command, Stdio};

use serde::Serialize;

#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct Editor {
    pub id: String,
    pub name: String,
}

const KNOWN: [(&str, &str, &str); 7] = [
    ("cursor", "Cursor", "cursor"),
    ("code", "Visual Studio Code", "code"),
    ("zed", "Zed", "zed"),
    ("windsurf", "Windsurf", "windsurf"),
    ("sublime", "Sublime Text", "subl"),
    ("nova", "Nova", "nova"),
    ("xcode", "Xcode", "xed"),
];

#[cfg(target_os = "macos")]
fn present(app: &str, _: &str) -> bool {
    let name = format!("{app}.app");
    let mut places = vec![std::path::PathBuf::from("/Applications")];
    if let Some(home) = std::env::home_dir() {
        places.push(home.join("Applications"));
    }
    places.iter().any(|place| place.join(&name).exists())
}

#[cfg(not(target_os = "macos"))]
fn present(_: &str, cli: &str) -> bool {
    sombre_harness::process::find(cli).is_some()
}

pub fn found() -> Vec<Editor> {
    KNOWN
        .iter()
        .filter(|(_, app, cli)| present(app, cli))
        .map(|(id, app, _)| Editor {
            id: (*id).to_string(),
            name: (*app).to_string(),
        })
        .collect()
}

#[cfg(target_os = "macos")]
fn command(path: &Path, known: Option<&(&str, &str, &str)>) -> Command {
    let mut command = Command::new("open");
    if let Some((_, app, _)) = known {
        command.args(["-a", app]);
    }
    command.arg(path);
    command
}

#[cfg(all(unix, not(target_os = "macos")))]
fn command(path: &Path, known: Option<&(&str, &str, &str)>) -> Command {
    let program = known
        .and_then(|(_, _, cli)| sombre_harness::process::find(cli))
        .unwrap_or_else(|| std::path::PathBuf::from("xdg-open"));
    let mut command = Command::new(program);
    command.arg(path);
    command
}

#[cfg(windows)]
fn command(path: &Path, known: Option<&(&str, &str, &str)>) -> Command {
    match known.and_then(|(_, _, cli)| sombre_harness::process::find(cli)) {
        Some(program) => {
            let mut command = Command::new(program);
            command.arg(path);
            command
        }
        None => {
            let mut command = Command::new("cmd");
            command.args(["/C", "start", ""]).arg(path);
            command
        }
    }
}

pub fn open(path: &Path, editor: Option<&str>) -> Result<(), String> {
    let known = editor.and_then(|id| KNOWN.iter().find(|(key, ..)| *key == id));
    let status = command(path, known)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|error| format!("couldn't open {}: {error}", path.display()))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "couldn't open {}. is {} still installed?",
            path.display(),
            known.map_or("its default app", |(_, app, _)| *app)
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_editor_has_a_unique_id() {
        let mut ids: Vec<&str> = KNOWN.iter().map(|(id, ..)| *id).collect();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), KNOWN.len());
    }
}
