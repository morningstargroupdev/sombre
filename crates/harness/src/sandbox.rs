use std::fs;
use std::path::{Path, PathBuf};

const CACHES: [&str; 8] = [
    ".cache",
    "Library/Caches",
    ".bun",
    ".npm",
    ".cargo",
    ".rustup",
    ".local/share",
    ".config",
];

pub fn profile(cwd: &Path) -> String {
    let mut places: Vec<PathBuf> = vec![
        real(cwd),
        PathBuf::from("/private/tmp"),
        PathBuf::from("/private/var/folders"),
    ];
    if let Some(home) = crate::process::home() {
        places.extend(CACHES.iter().map(|cache| home.join(cache)));
    }
    let allowed: String = places
        .iter()
        .map(|place| format!(" (subpath \"{}\")", quote(&place.display().to_string())))
        .collect();
    format!(
        "(version 1)(allow default)(deny file-write*)(allow file-write*{allowed} (regex #\"^/dev/\"))"
    )
}

pub fn real(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn quote(text: &str) -> String {
    text.replace('\\', "\\\\").replace('"', "\\\"")
}

pub fn blocked(output: &str) -> bool {
    output.contains("Operation not permitted") || output.contains("operation not permitted")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_writes_only_in_safe_places() {
        let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        let text = profile(dir.path());
        assert!(text.starts_with("(version 1)(allow default)(deny file-write*)"));
        assert!(text.contains(&format!(
            "(subpath \"{}\")",
            quote(&real(dir.path()).display().to_string())
        )));
        assert!(text.contains("(subpath \"/private/tmp\")"));
    }

    #[test]
    fn quotes_paths_safely() {
        assert_eq!(quote(r#"a"b\c"#), r#"a\"b\\c"#);
    }

    #[test]
    fn spots_sandbox_refusals() {
        assert!(blocked("zsh:1: operation not permitted: /etc/x"));
        assert!(!blocked("all good"));
    }
}
