use std::fs;
use std::path::Path;

use crate::git;

const MOST: usize = 20_000;
const DEEPEST: usize = 12;
const SKIP: [&str; 8] = [
    ".git",
    "node_modules",
    "target",
    ".next",
    "dist",
    "build",
    ".venv",
    "__pycache__",
];

pub fn list(folder: &Path) -> Vec<String> {
    git::listed(folder).unwrap_or_else(|| {
        let mut found = Vec::new();
        walk(folder, folder, 0, &mut found);
        found.sort();
        found
    })
}

fn walk(root: &Path, folder: &Path, depth: usize, found: &mut Vec<String>) {
    if depth > DEEPEST || found.len() >= MOST {
        return;
    }
    let Ok(entries) = fs::read_dir(folder) else {
        return;
    };
    for entry in entries.flatten() {
        if found.len() >= MOST {
            return;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') || SKIP.contains(&name.as_str()) {
            continue;
        }
        let path = entry.path();
        match entry.file_type() {
            Ok(kind) if kind.is_dir() => walk(root, &path, depth + 1, found),
            Ok(kind) if kind.is_file() => {
                if let Ok(relative) = path.strip_prefix(root) {
                    found.push(relative.to_string_lossy().replace('\\', "/"));
                }
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(path: &Path) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap_or_else(|error| panic!("{error}"));
        }
        fs::write(path, "x").unwrap_or_else(|error| panic!("{error}"));
    }

    #[test]
    fn walks_plain_folders_and_skips_noise() {
        let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        write(&dir.path().join("src/app.ts"));
        write(&dir.path().join("README.md"));
        write(&dir.path().join("node_modules/pkg/index.js"));
        write(&dir.path().join(".env"));
        assert_eq!(list(dir.path()), ["README.md", "src/app.ts"]);
    }
}
