use std::fs;
use std::path::Path;

use crate::session::{Agent, Session};
use crate::{Roots, handoff};

pub type Erase<'a> = &'a dyn Fn(&str) -> Result<(), String>;

fn remove(path: &Path) -> Result<(), String> {
    fs::remove_file(path).map_err(|error| format!("couldn't delete {}: {error}", path.display()))
}

pub fn purge(
    roots: &Roots,
    folder: &Path,
    sessions: &[Session],
    codex: Erase,
) -> Result<usize, String> {
    let mut gone = 0;
    for session in sessions.iter().filter(|session| session.cwd == folder) {
        match session.agent {
            Agent::Codex => codex(&session.id)?,
            Agent::Sombre => remove(&session.path)?,
            Agent::Claude => {
                remove(&session.path)?;
                for extra in [
                    session.path.with_extension(""),
                    roots.claude.join("session-env").join(&session.id),
                ] {
                    if extra.is_dir() {
                        fs::remove_dir_all(&extra).map_err(|error| {
                            format!("couldn't delete {}: {error}", extra.display())
                        })?;
                    }
                }
                if let Some(project) = session.path.parent()
                    && fs::read_dir(project).is_ok_and(|mut entries| entries.next().is_none())
                {
                    fs::remove_dir(project).map_err(|error| {
                        format!("couldn't delete {}: {error}", project.display())
                    })?;
                }
            }
        }
        if let Some(kept) = crate::ledger::path(roots, session.agent, &session.id)
            && kept.exists()
        {
            remove(&kept)?;
        }
        gone += 1;
    }
    handoff::forget(roots, folder, codex)?;
    Ok(gone)
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::io::Write;
    use std::path::PathBuf;

    use super::*;

    fn roots(dir: &Path) -> Roots {
        Roots {
            claude: dir.join("claude"),
            codex: dir.join("codex"),
            sombre: dir.join("sombre"),
        }
    }

    fn chat(path: &Path, cwd: &str, prompt: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap_or_else(|error| panic!("{error}"));
        }
        let mut file = fs::File::create(path).unwrap_or_else(|error| panic!("{error}"));
        writeln!(
            file,
            r#"{{"type":"user","cwd":"{cwd}","message":{{"role":"user","content":"{prompt}"}}}}"#
        )
        .unwrap_or_else(|error| panic!("{error}"));
    }

    fn write(path: &Path, text: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap_or_else(|error| panic!("{error}"));
        }
        fs::write(path, text).unwrap_or_else(|error| panic!("{error}"));
    }

    #[test]
    fn deletes_every_chat_in_a_folder_and_nothing_else() {
        let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        let roots = roots(dir.path());
        let atlas = roots.claude.join("projects/-work-atlas/a1.jsonl");
        chat(&atlas, "/work/atlas", "first chat");
        chat(
            &roots.claude.join("projects/-work-other/b1.jsonl"),
            "/work/other",
            "other chat",
        );
        write(
            &roots
                .claude
                .join("projects/-work-atlas/a1/subagents/s1.jsonl"),
            "{}",
        );
        write(&roots.claude.join("session-env/a1/env"), "");
        let archived = roots.claude.join("sombre-archive/a0.jsonl");
        write(&archived, "{}");
        let thread = roots.sombre.join("threads/t1.json");
        write(
            &thread,
            r#"{"id":"t1","cwd":"/work/atlas","log":[],"copies":[{"agent":"claude","session":"a0","home":"/work/claude","synced":0,"base":0,"archived":true},{"agent":"codex","session":"c0","home":"/work/codex","synced":0,"base":0,"archived":true}]}"#,
        );
        let mut sessions = crate::scan(&roots);
        assert_eq!(sessions.len(), 2);
        sessions.push(Session {
            agent: Agent::Codex,
            cwd: PathBuf::from("/work/atlas"),
            id: "c1".to_string(),
            path: PathBuf::new(),
            title: String::new(),
            updated: 0,
        });
        let asked = RefCell::new(Vec::new());
        let gone = purge(&roots, Path::new("/work/atlas"), &sessions, &|id| {
            asked.borrow_mut().push(id.to_string());
            Ok(())
        });
        assert_eq!(gone, Ok(2));
        assert_eq!(*asked.borrow(), ["c1", "c0"]);
        let left = crate::scan(&roots);
        assert_eq!(left.len(), 1);
        assert_eq!(left[0].cwd, Path::new("/work/other"));
        assert!(!atlas.exists());
        assert!(!roots.claude.join("projects/-work-atlas").exists());
        assert!(roots.claude.join("projects/-work-other").exists());
        assert!(!roots.claude.join("session-env/a1").exists());
        assert!(!archived.exists());
        assert!(!thread.exists());
    }

    #[test]
    fn stops_when_codex_refuses() {
        let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        let roots = roots(dir.path());
        let sessions = [Session {
            agent: Agent::Codex,
            cwd: PathBuf::from("/work/atlas"),
            id: "c1".to_string(),
            path: PathBuf::new(),
            title: String::new(),
            updated: 0,
        }];
        let gone = purge(&roots, Path::new("/work/atlas"), &sessions, &|_| {
            Err("codex isn't installed".to_string())
        });
        assert_eq!(gone, Err("codex isn't installed".to_string()));
    }
}
