use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const NOTES: [&str; 2] = ["AGENTS.md", "CLAUDE.md"];
const LIMIT: usize = 32_000;

pub fn globals() -> Vec<PathBuf> {
    sombre_core::Roots::detect().map_or_else(Vec::new, |roots| {
        vec![
            roots.claude.join("CLAUDE.md"),
            roots.codex.join("AGENTS.md"),
            roots.sombre.join("AGENTS.md"),
        ]
    })
}

fn chain(cwd: &Path) -> Vec<PathBuf> {
    let root = cwd
        .ancestors()
        .find(|folder| folder.join(".git").exists())
        .unwrap_or(cwd);
    let mut folders: Vec<&Path> = cwd
        .ancestors()
        .take_while(|folder| folder.starts_with(root))
        .collect();
    folders.reverse();
    folders
        .into_iter()
        .filter_map(|folder| {
            NOTES
                .iter()
                .map(|name| folder.join(name))
                .find(|path| path.is_file())
        })
        .collect()
}

pub fn notes(cwd: &Path, globals: &[PathBuf]) -> Vec<(PathBuf, String)> {
    let mut seen: Vec<PathBuf> = Vec::new();
    let mut found = Vec::new();
    let mut left = LIMIT;
    for path in globals.iter().cloned().chain(chain(cwd)) {
        let Ok(real) = fs::canonicalize(&path) else {
            continue;
        };
        if seen.contains(&real) || left == 0 {
            continue;
        }
        seen.push(real);
        let Ok(text) = fs::read_to_string(&path) else {
            continue;
        };
        let text: String = text.chars().take(left).collect();
        left -= text.chars().count();
        if !text.trim().is_empty() {
            found.push((path, text));
        }
    }
    found
}

fn shown(path: &Path) -> String {
    let home = crate::process::home();
    match home.as_ref().and_then(|home| path.strip_prefix(home).ok()) {
        Some(rest) => format!("~/{}", rest.display()),
        None => path.display().to_string(),
    }
}

pub fn system(cwd: &Path) -> String {
    let mut text = format!(
        "You are Sombre, a coding agent working in the user's terminal on {}. The project folder is {}.\n\
         Use the tools to look around, change files, and run commands. Prefer the built-in tools over the shell \
         for reading files and folders, searching, and fetching pages. Read a file before you change it. \
         Run checks after changes when the project has them.\n\
         Keep replies short and plain. Say what you changed and how you checked it.",
        env::consts::OS,
        cwd.display()
    );
    let found = notes(cwd, &globals());
    if !found.is_empty() {
        text.push_str("\n\nThe user's instructions follow, from their global files down to this folder. Follow them. When two disagree, the later one wins.");
    }
    for (path, notes) in found {
        text.push_str(&format!("\n\nInstructions from {}:\n{notes}", shown(&path)));
    }
    text.push_str(&crate::skills::prompt(&crate::skills::find(cwd)));
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_the_project_folder() {
        let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        let text = system(dir.path());
        assert!(text.contains(&dir.path().display().to_string()));
        assert!(notes(dir.path(), &[]).is_empty());
    }

    #[test]
    fn includes_project_instructions() {
        let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        fs::write(dir.path().join("AGENTS.md"), "use bun")
            .unwrap_or_else(|error| panic!("{error}"));
        assert!(system(dir.path()).contains("AGENTS.md:\nuse bun"));
    }

    #[test]
    fn reads_global_rules_then_the_repo_root_down_to_the_folder() {
        let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        let write = |path: &Path, text: &str| {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).unwrap_or_else(|error| panic!("{error}"));
            }
            fs::write(path, text).unwrap_or_else(|error| panic!("{error}"));
        };
        let global = dir.path().join("home/.claude/CLAUDE.md");
        write(&global, "global rules");
        let linked = dir.path().join("home/.codex/AGENTS.md");
        fs::create_dir_all(dir.path().join("home/.codex"))
            .unwrap_or_else(|error| panic!("{error}"));
        #[cfg(unix)]
        std::os::unix::fs::symlink(&global, &linked).unwrap_or_else(|error| panic!("{error}"));
        let repo = dir.path().join("repo");
        fs::create_dir_all(repo.join(".git")).unwrap_or_else(|error| panic!("{error}"));
        write(&repo.join("AGENTS.md"), "root rules");
        write(&repo.join("app/CLAUDE.md"), "app rules");
        fs::create_dir_all(repo.join("app/src")).unwrap_or_else(|error| panic!("{error}"));
        write(&dir.path().join("AGENTS.md"), "outside the repo");
        let found: Vec<String> = notes(&repo.join("app/src"), &[global, linked])
            .into_iter()
            .map(|(_, text)| text)
            .collect();
        assert_eq!(found, ["global rules", "root rules", "app rules"]);
    }
}
