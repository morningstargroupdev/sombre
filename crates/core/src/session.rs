use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Agent {
    Claude,
    Codex,
    Sombre,
}

impl Agent {
    pub fn name(self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::Codex => "codex",
            Self::Sombre => "sombre",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Session {
    pub agent: Agent,
    pub id: String,
    pub title: String,
    pub cwd: PathBuf,
    pub updated: u64,
    #[serde(skip)]
    pub path: PathBuf,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Model {
    pub id: String,
    pub about: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Lookup<'a> {
    Found(&'a Session),
    Missing,
    Ambiguous(Vec<&'a Session>),
}

const LIMIT: usize = 80;

pub fn named(raw: &str) -> Result<String, &'static str> {
    let trimmed = raw.trim();
    let unquoted = ['"', '\'']
        .iter()
        .find_map(|quote| {
            trimmed
                .strip_prefix(*quote)
                .and_then(|rest| rest.strip_suffix(*quote))
                .filter(|inner| !inner.contains(*quote))
        })
        .unwrap_or(trimmed)
        .trim();
    if unquoted.is_empty() {
        return Err("give the chat a name, like /rename deploy fix");
    }
    if unquoted.contains(['\n', '\r']) {
        return Err("keep the name on one line");
    }
    if unquoted.chars().any(char::is_control) {
        return Err("names can't have control characters");
    }
    if unquoted.chars().count() > LIMIT {
        return Err("keep the name under 80 characters");
    }
    Ok(unquoted.to_string())
}

pub fn title(text: &str) -> Option<String> {
    let clean = crate::scrub::scrub(text)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if clean.is_empty() {
        return None;
    }
    if clean.chars().count() <= LIMIT {
        return Some(clean);
    }
    let cut: String = clean.chars().take(LIMIT - 1).collect();
    Some(format!("{}…", cut.trim_end()))
}

pub fn seconds(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

pub fn now() -> u64 {
    seconds(SystemTime::now())
}

pub fn ago(updated: u64, now: u64) -> String {
    let delta = now.saturating_sub(updated);
    match delta {
        0..60 => "now".to_string(),
        60..3_600 => format!("{}m ago", delta / 60),
        3_600..86_400 => format!("{}h ago", delta / 3_600),
        86_400..604_800 => format!("{}d ago", delta / 86_400),
        _ => format!("{}w ago", delta / 604_800),
    }
}

pub fn find<'a>(sessions: &'a [Session], prefix: &str) -> Lookup<'a> {
    let prefix = prefix.trim();
    if prefix.is_empty() {
        return Lookup::Missing;
    }
    if let Some(exact) = sessions.iter().find(|session| session.id == prefix) {
        return Lookup::Found(exact);
    }
    let matches: Vec<&Session> = sessions
        .iter()
        .filter(|session| session.id.starts_with(prefix))
        .collect();
    match matches.as_slice() {
        [] => Lookup::Missing,
        [only] => Lookup::Found(only),
        _ => Lookup::Ambiguous(matches),
    }
}

pub fn here<'a>(sessions: &'a [Session], dir: &Path) -> Vec<&'a Session> {
    let target = resolve(dir);
    sessions
        .iter()
        .filter(|session| resolve(&session.cwd) == target)
        .collect()
}

fn resolve(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session(agent: Agent, id: &str) -> Session {
        Session {
            agent,
            cwd: PathBuf::from("/work/atlas"),
            id: id.to_string(),
            path: PathBuf::new(),
            title: "fix the flaky test".to_string(),
            updated: 0,
        }
    }

    #[test]
    fn checks_names_like_fx_does() {
        assert_eq!(named("  \"deploy fix\"  "), Ok("deploy fix".to_string()));
        assert_eq!(named("'it's'"), Ok("'it's'".to_string()));
        assert_eq!(named("plain"), Ok("plain".to_string()));
        assert!(named("   ").is_err());
        assert!(named("two\nlines").is_err());
        assert!(named("bell\u{7}").is_err());
        assert!(named(&"x".repeat(81)).is_err());
    }

    #[test]
    fn title_collapses_whitespace() {
        assert_eq!(
            title("  fix   the\n\nflaky  test "),
            Some("fix the flaky test".to_string())
        );
    }

    #[test]
    fn title_rejects_empty_text() {
        assert_eq!(title(" \n\t "), None);
    }

    #[test]
    fn title_truncates_long_text_on_a_character_boundary() {
        let long = "é".repeat(200);
        let result = title(&long).unwrap_or_default();
        assert_eq!(result.chars().count(), LIMIT);
        assert!(result.ends_with('…'));
    }

    #[test]
    fn ago_reads_naturally() {
        assert_eq!(ago(1_000, 1_030), "now");
        assert_eq!(ago(0, 125), "2m ago");
        assert_eq!(ago(0, 7_300), "2h ago");
        assert_eq!(ago(0, 200_000), "2d ago");
        assert_eq!(ago(0, 1_300_000), "2w ago");
    }

    #[test]
    fn ago_handles_clock_skew() {
        assert_eq!(ago(500, 100), "now");
    }

    #[test]
    fn find_prefers_an_exact_id() {
        let sessions = [session(Agent::Claude, "ab"), session(Agent::Codex, "abc")];
        assert_eq!(find(&sessions, "ab"), Lookup::Found(&sessions[0]));
    }

    #[test]
    fn find_accepts_a_unique_prefix() {
        let sessions = [
            session(Agent::Claude, "abc1"),
            session(Agent::Codex, "def2"),
        ];
        assert_eq!(find(&sessions, "de"), Lookup::Found(&sessions[1]));
    }

    #[test]
    fn find_reports_ambiguous_prefixes() {
        let sessions = [
            session(Agent::Claude, "abc1"),
            session(Agent::Codex, "abc2"),
        ];
        assert_eq!(
            find(&sessions, "abc"),
            Lookup::Ambiguous(vec![&sessions[0], &sessions[1]])
        );
    }

    #[test]
    fn find_reports_missing_and_blank_ids() {
        let sessions = [session(Agent::Claude, "abc1")];
        assert_eq!(find(&sessions, "zzz"), Lookup::Missing);
        assert_eq!(find(&sessions, "  "), Lookup::Missing);
    }

    #[test]
    fn here_keeps_only_sessions_from_this_folder() {
        let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        let mut inside = session(Agent::Claude, "in");
        inside.cwd = dir.path().to_path_buf();
        let outside = session(Agent::Codex, "out");
        let sessions = [inside, outside];
        assert_eq!(here(&sessions, dir.path()), vec![&sessions[0]]);
    }

    #[cfg(unix)]
    #[test]
    fn here_matches_folders_reached_through_a_symlink() {
        let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap_or_else(|error| panic!("{error}"));
        std::os::unix::fs::symlink(&real, &link).unwrap_or_else(|error| panic!("{error}"));
        let mut inside = session(Agent::Claude, "in");
        inside.cwd = real;
        let sessions = [inside];
        assert_eq!(here(&sessions, &link).len(), 1);
    }
}
