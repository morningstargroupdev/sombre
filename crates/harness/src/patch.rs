use std::fs;
use std::path::{Path, PathBuf};

use crate::tools::resolve;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Hunk {
    Add {
        path: String,
        lines: Vec<String>,
    },
    Delete {
        path: String,
    },
    Update {
        path: String,
        to: Option<String>,
        chunks: Vec<Chunk>,
    },
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Chunk {
    pub context: Option<String>,
    pub old: Vec<String>,
    pub new: Vec<String>,
    pub end: bool,
}

pub struct Applied {
    pub summary: String,
    pub lines: Vec<String>,
}

impl Hunk {
    pub fn paths(&self) -> Vec<&str> {
        match self {
            Self::Add { path, .. } | Self::Delete { path } => vec![path],
            Self::Update { path, to, .. } => {
                let mut paths = vec![path.as_str()];
                paths.extend(to.as_deref());
                paths
            }
        }
    }
}

pub fn parse(text: &str) -> Result<Vec<Hunk>, String> {
    let lines: Vec<&str> = text.lines().collect();
    let start = lines
        .iter()
        .position(|line| line.trim() == "*** Begin Patch")
        .ok_or("the patch must start with *** Begin Patch")?;
    let mut hunks: Vec<Hunk> = Vec::new();
    let mut index = start + 1;
    while index < lines.len() {
        let line = lines[index];
        index += 1;
        if line.trim() == "*** End Patch" {
            if hunks.is_empty() {
                return Err("the patch has no file sections".to_string());
            }
            return Ok(hunks);
        }
        if let Some(path) = line.strip_prefix("*** Add File: ") {
            let mut added = Vec::new();
            while index < lines.len() && !lines[index].starts_with("*** ") {
                added.push(
                    lines[index]
                        .strip_prefix('+')
                        .unwrap_or(lines[index])
                        .to_string(),
                );
                index += 1;
            }
            hunks.push(Hunk::Add {
                lines: added,
                path: path.trim().to_string(),
            });
        } else if let Some(path) = line.strip_prefix("*** Delete File: ") {
            hunks.push(Hunk::Delete {
                path: path.trim().to_string(),
            });
        } else if let Some(path) = line.strip_prefix("*** Update File: ") {
            let mut to = None;
            if let Some(target) = lines
                .get(index)
                .and_then(|next| next.strip_prefix("*** Move to: "))
            {
                to = Some(target.trim().to_string());
                index += 1;
            }
            let mut chunks: Vec<Chunk> = Vec::new();
            while index < lines.len() {
                let body = lines[index];
                if body.starts_with("*** ") && body.trim() != "*** End of File" {
                    break;
                }
                index += 1;
                if body.trim() == "*** End of File" {
                    if let Some(chunk) = chunks.last_mut() {
                        chunk.end = true;
                    }
                    continue;
                }
                if body.starts_with("@@") {
                    let context = body.trim_start_matches('@').trim();
                    chunks.push(Chunk {
                        context: (!context.is_empty()).then(|| context.to_string()),
                        ..Chunk::default()
                    });
                    continue;
                }
                if chunks.is_empty() {
                    chunks.push(Chunk::default());
                }
                let Some(chunk) = chunks.last_mut() else {
                    continue;
                };
                match body.chars().next() {
                    Some('+') => chunk.new.push(body[1..].to_string()),
                    Some('-') => chunk.old.push(body[1..].to_string()),
                    Some(' ') => {
                        chunk.old.push(body[1..].to_string());
                        chunk.new.push(body[1..].to_string());
                    }
                    _ => {
                        chunk.old.push(body.to_string());
                        chunk.new.push(body.to_string());
                    }
                }
            }
            if chunks
                .iter()
                .all(|chunk| chunk.old.is_empty() && chunk.new.is_empty())
                && to.is_none()
            {
                return Err(format!("the update for {} has no changes", path.trim()));
            }
            hunks.push(Hunk::Update {
                chunks,
                path: path.trim().to_string(),
                to,
            });
        } else if !line.trim().is_empty() {
            return Err(format!("unexpected line in the patch: {line}"));
        }
    }
    Err("the patch must end with *** End Patch".to_string())
}

fn find(lines: &[String], wanted: &[String], from: usize, end: bool) -> Option<usize> {
    if wanted.is_empty() {
        return Some(if end {
            lines.len()
        } else {
            from.min(lines.len())
        });
    }
    if wanted.len() > lines.len() {
        return None;
    }
    let last = lines.len() - wanted.len();
    let tries: [fn(&str) -> &str; 3] = [|text| text, str::trim_end, str::trim];
    for normal in tries {
        let matches = |at: usize| {
            wanted
                .iter()
                .zip(&lines[at..])
                .all(|(want, have)| normal(want) == normal(have))
        };
        if end && matches(last) {
            return Some(last);
        }
        if let Some(at) = (from.min(last + 1)..=last).find(|at| matches(*at)) {
            return Some(at);
        }
    }
    None
}

fn update(text: &str, chunks: &[Chunk], path: &str) -> Result<String, String> {
    let mut lines: Vec<String> = text.lines().map(str::to_string).collect();
    let mut cursor = 0;
    for chunk in chunks {
        if let Some(context) = &chunk.context {
            let at = lines
                .iter()
                .skip(cursor)
                .position(|line| line.trim() == context.trim())
                .map(|offset| cursor + offset)
                .ok_or_else(|| {
                    format!("couldn't find `{context}` in {path}. read the file and try again")
                })?;
            cursor = at + 1;
        }
        let at = find(&lines, &chunk.old, cursor, chunk.end).ok_or_else(|| {
            format!(
                "couldn't find the lines to change in {path}, starting with `{}`. read the file and try again",
                chunk.old.first().map_or("", String::as_str)
            )
        })?;
        lines.splice(at..at + chunk.old.len(), chunk.new.iter().cloned());
        cursor = at + chunk.new.len();
    }
    let mut joined = lines.join("\n");
    if text.ends_with('\n') || text.is_empty() {
        joined.push('\n');
    }
    Ok(joined)
}

pub fn apply(text: &str, cwd: &Path) -> Result<Applied, String> {
    let hunks = parse(text)?;
    let mut writes: Vec<(PathBuf, Option<String>)> = Vec::new();
    let mut lines: Vec<String> = Vec::new();
    let mut done: Vec<String> = Vec::new();
    for hunk in &hunks {
        match hunk {
            Hunk::Add { path, lines: added } => {
                let file = resolve(cwd, path);
                if file.exists() {
                    return Err(format!(
                        "{path} already exists. use *** Update File to change it"
                    ));
                }
                lines.extend(added.iter().map(|line| format!("+{line}")));
                writes.push((file, Some(format!("{}\n", added.join("\n")))));
                done.push(format!("added {path}"));
            }
            Hunk::Delete { path } => {
                let file = resolve(cwd, path);
                let before = fs::read_to_string(&file)
                    .map_err(|error| format!("couldn't read {path}: {error}"))?;
                lines.extend(before.lines().map(|line| format!("-{line}")));
                writes.push((file, None));
                done.push(format!("deleted {path}"));
            }
            Hunk::Update { path, to, chunks } => {
                let file = resolve(cwd, path);
                let before = fs::read_to_string(&file)
                    .map_err(|error| format!("couldn't read {path}: {error}"))?;
                let after = update(&before, chunks, path)?;
                for chunk in chunks {
                    let kept: Vec<&String> = chunk
                        .old
                        .iter()
                        .filter(|line| chunk.new.contains(line))
                        .collect();
                    lines.extend(
                        chunk
                            .old
                            .iter()
                            .filter(|line| !kept.contains(line))
                            .map(|line| format!("-{line}")),
                    );
                    lines.extend(
                        chunk
                            .new
                            .iter()
                            .filter(|line| !kept.contains(line))
                            .map(|line| format!("+{line}")),
                    );
                }
                match to {
                    Some(target) => {
                        writes.push((file, None));
                        writes.push((resolve(cwd, target), Some(after)));
                        done.push(format!("moved {path} to {target}"));
                    }
                    None => {
                        writes.push((file, Some(after)));
                        done.push(format!("updated {path}"));
                    }
                }
            }
        }
    }
    for (file, contents) in &writes {
        match contents {
            Some(contents) => {
                if let Some(parent) = file.parent() {
                    fs::create_dir_all(parent).map_err(|error| {
                        format!("couldn't create {}: {error}", parent.display())
                    })?;
                }
                fs::write(file, contents)
                    .map_err(|error| format!("couldn't write {}: {error}", file.display()))?;
            }
            None => {
                if writes
                    .iter()
                    .all(|(other, kept)| other != file || kept.is_none())
                {
                    fs::remove_file(file)
                        .map_err(|error| format!("couldn't delete {}: {error}", file.display()))?;
                }
            }
        }
    }
    Ok(Applied {
        lines,
        summary: done.join("\n"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        fs::write(
            dir.path().join("app.py"),
            "def greet():\n    print(\"Hi\")\n\ndef main():\n    greet()\n",
        )
        .unwrap_or_else(|error| panic!("{error}"));
        fs::write(dir.path().join("old.txt"), "bye\n").unwrap_or_else(|error| panic!("{error}"));
        dir
    }

    #[test]
    fn applies_the_codex_example_across_files() {
        let dir = project();
        let patch = "*** Begin Patch\n*** Add File: hello.txt\n+Hello world\n*** Update File: app.py\n*** Move to: main.py\n@@ def greet():\n-    print(\"Hi\")\n+    print(\"Hello, world!\")\n*** Delete File: old.txt\n*** End Patch";
        let applied = apply(patch, dir.path()).unwrap_or_else(|error| panic!("{error}"));
        assert_eq!(
            fs::read_to_string(dir.path().join("hello.txt")).unwrap_or_default(),
            "Hello world\n"
        );
        assert!(
            fs::read_to_string(dir.path().join("main.py"))
                .unwrap_or_default()
                .contains("Hello, world!")
        );
        assert!(!dir.path().join("app.py").exists());
        assert!(!dir.path().join("old.txt").exists());
        assert!(applied.summary.contains("moved app.py to main.py"));
        assert!(
            applied
                .lines
                .contains(&"+    print(\"Hello, world!\")".to_string())
        );
    }

    #[test]
    fn edits_several_places_in_one_file() {
        let dir = project();
        let patch = "*** Begin Patch\n*** Update File: app.py\n@@ def greet():\n-    print(\"Hi\")\n+    print(\"Hey\")\n@@ def main():\n-    greet()\n+    greet()\n+    greet()\n*** End Patch\n";
        apply(patch, dir.path()).unwrap_or_else(|error| panic!("{error}"));
        assert_eq!(
            fs::read_to_string(dir.path().join("app.py")).unwrap_or_default(),
            "def greet():\n    print(\"Hey\")\n\ndef main():\n    greet()\n    greet()\n"
        );
    }

    #[test]
    fn tolerates_trailing_whitespace_differences() {
        let dir = project();
        let patch = "*** Begin Patch\n*** Update File: app.py\n-    print(\"Hi\")   \n+    print(\"Ok\")\n*** End Patch";
        apply(patch, dir.path()).unwrap_or_else(|error| panic!("{error}"));
        assert!(
            fs::read_to_string(dir.path().join("app.py"))
                .unwrap_or_default()
                .contains("Ok")
        );
    }

    #[test]
    fn leaves_every_file_alone_when_one_change_fails() {
        let dir = project();
        let patch = "*** Begin Patch\n*** Add File: new.txt\n+x\n*** Update File: app.py\n-not in the file\n+y\n*** End Patch";
        let error = apply(patch, dir.path()).err().unwrap_or_default();
        assert!(
            error.contains("couldn't find the lines to change in app.py"),
            "{error}"
        );
        assert!(!dir.path().join("new.txt").exists());
    }

    #[test]
    fn explains_malformed_patches() {
        assert!(parse("hello").is_err());
        assert!(parse("*** Begin Patch\n*** Add File: a\n+x").is_err());
        assert!(parse("*** Begin Patch\n*** End Patch").is_err());
        assert!(parse("*** Begin Patch\nnonsense\n*** End Patch").is_err());
    }

    #[test]
    fn lists_every_path_a_patch_touches() {
        let hunks = parse("*** Begin Patch\n*** Update File: a.rs\n*** Move to: b.rs\n-x\n+y\n*** Delete File: c.rs\n*** End Patch")
            .unwrap_or_default();
        let paths: Vec<&str> = hunks.iter().flat_map(Hunk::paths).collect();
        assert_eq!(paths, ["a.rs", "b.rs", "c.rs"]);
    }
}
