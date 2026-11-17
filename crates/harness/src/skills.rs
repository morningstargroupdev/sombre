use std::fs;
use std::path::{Path, PathBuf};

use crate::process;

const PLACES: [&str; 3] = [".sombre/skills", ".claude/skills", ".agents/skills"];
const SHOWN: usize = 60;
const ABOUT: usize = 240;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Skill {
    pub name: String,
    pub about: String,
    pub path: PathBuf,
}

pub fn parse(text: &str, folder: &str) -> (String, String) {
    let mut name = folder.to_string();
    let mut about = String::new();
    let mut body = text;
    if let Some(rest) = text.strip_prefix("---")
        && let Some(end) = rest.find("\n---")
    {
        for line in rest[..end].lines() {
            if let Some((key, value)) = line.split_once(':') {
                let value = value.trim().trim_matches(['"', '\'']).to_string();
                match key.trim() {
                    "name" if !value.is_empty() => name = value,
                    "description" => about = value,
                    _ => {}
                }
            }
        }
        body = &rest[end + 4..];
    }
    if about.is_empty() {
        about = body
            .lines()
            .map(|line| line.trim().trim_start_matches('#').trim())
            .find(|line| !line.is_empty())
            .unwrap_or_default()
            .to_string();
    }
    let about = if about.chars().count() > ABOUT {
        format!("{}…", about.chars().take(ABOUT - 1).collect::<String>())
    } else {
        about
    };
    (name, about)
}

fn scan(root: &Path, found: &mut Vec<Skill>) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    let mut folders: Vec<PathBuf> = entries.flatten().map(|entry| entry.path()).collect();
    folders.sort();
    for folder in folders {
        let path = folder.join("SKILL.md");
        let Ok(text) = fs::read_to_string(&path) else {
            continue;
        };
        let label = folder
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();
        let (name, about) = parse(&text, &label);
        if found.iter().any(|skill| skill.name == name) {
            continue;
        }
        found.push(Skill { about, name, path });
    }
}

pub fn find(cwd: &Path) -> Vec<Skill> {
    let mut found = Vec::new();
    for place in PLACES {
        scan(&cwd.join(place), &mut found);
    }
    if let Some(home) = process::home() {
        for place in PLACES {
            scan(&home.join(place), &mut found);
        }
    }
    found
}

pub fn prompt(skills: &[Skill]) -> String {
    if skills.is_empty() {
        return String::new();
    }
    let mut text = String::from(
        "\n\nSkills are saved instructions for specific jobs. When one fits the task, read its SKILL.md with the read tool first and follow it. Available skills:",
    );
    for skill in skills.iter().take(SHOWN) {
        text.push_str(&format!(
            "\n- {}: {} ({})",
            skill.name,
            skill.about,
            skill.path.display()
        ));
    }
    if skills.len() > SHOWN {
        text.push_str(&format!("\n- and {} more", skills.len() - SHOWN));
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    fn skill(root: &Path, folder: &str, text: &str) {
        let dir = root.join(folder);
        fs::create_dir_all(&dir).unwrap_or_else(|error| panic!("{error}"));
        fs::write(dir.join("SKILL.md"), text).unwrap_or_else(|error| panic!("{error}"));
    }

    #[test]
    fn reads_frontmatter() {
        assert_eq!(
            parse(
                "---\nname: tmux\ndescription: \"Drive tmux panes\"\n---\n# Tmux\nsteps",
                "x"
            ),
            ("tmux".to_string(), "Drive tmux panes".to_string())
        );
    }

    #[test]
    fn falls_back_to_the_folder_and_first_line() {
        assert_eq!(
            parse("When the user runs /cs, write a changeset.\n\nmore", "cs"),
            (
                "cs".to_string(),
                "When the user runs /cs, write a changeset.".to_string()
            )
        );
        let long = "x".repeat(400);
        assert_eq!(parse(&long, "big").1.chars().count(), ABOUT);
    }

    #[test]
    fn prefers_project_skills_and_skips_folders_without_one() {
        let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        skill(
            &dir.path().join(".sombre/skills"),
            "deploy",
            "---\nname: deploy\ndescription: project deploy\n---\n",
        );
        skill(
            &dir.path().join(".claude/skills"),
            "deploy",
            "---\nname: deploy\ndescription: other deploy\n---\n",
        );
        skill(
            &dir.path().join(".agents/skills"),
            "lint",
            "Run the linter.",
        );
        fs::create_dir_all(dir.path().join(".agents/skills/empty"))
            .unwrap_or_else(|error| panic!("{error}"));
        let found: Vec<(String, String)> = find(dir.path())
            .into_iter()
            .filter(|skill| skill.path.starts_with(dir.path()))
            .map(|skill| (skill.name, skill.about))
            .collect();
        assert_eq!(
            found,
            [
                ("deploy".to_string(), "project deploy".to_string()),
                ("lint".to_string(), "Run the linter.".to_string())
            ]
        );
    }

    #[test]
    fn lists_skills_for_the_model_with_their_paths() {
        let text = prompt(&[Skill {
            about: "Drive tmux panes".to_string(),
            name: "tmux".to_string(),
            path: PathBuf::from("/s/tmux/SKILL.md"),
        }]);
        assert!(text.contains("- tmux: Drive tmux panes (/s/tmux/SKILL.md)"));
        assert!(text.contains("read its SKILL.md"));
        assert_eq!(prompt(&[]), "");
    }
}
