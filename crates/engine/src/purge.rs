use std::path::Path;
use std::process::{Command, Stdio};

use sombre_core::{Roots, Session};
use sombre_harness::process;

fn erase(id: &str) -> Result<(), String> {
    let program = process::find("codex")
        .ok_or("codex isn't installed, so its chats in this folder can't be deleted")?;
    let output = Command::new(program)
        .args(["delete", "--force", id])
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("couldn't run codex: {error}"))?;
    if output.status.success() {
        return Ok(());
    }
    let said = String::from_utf8_lossy(&output.stderr);
    Err(format!(
        "codex couldn't delete a chat: {}",
        said.trim().lines().last().unwrap_or("no reason given")
    ))
}

pub fn run(roots: &Roots, folder: &Path, sessions: &[Session]) -> Result<usize, String> {
    sombre_core::purge::purge(roots, folder, sessions, &erase)
}
