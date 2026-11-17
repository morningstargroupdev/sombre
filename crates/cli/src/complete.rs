const COMMANDS: [&str; 17] = [
    "/resume",
    "/status",
    "/compact",
    "/skills",
    "/mcp",
    "/settings",
    "/pair",
    "/goal",
    "/new",
    "/rename",
    "/model",
    "/agent",
    "/provider",
    "/permissions",
    "/effort",
    "/help",
    "/exit",
];
const AGENTS: [&str; 3] = ["claude", "codex", "sombre"];
const MODES: [&str; 3] = ["ask", "auto", "yolo"];
const EFFORTS: [&str; 7] = [
    "default", "minimal", "low", "medium", "high", "xhigh", "max",
];
const GOALS: [&str; 3] = ["pause", "resume", "clear"];

pub fn suggest(line: &str, models: &[String]) -> Option<String> {
    if !line.starts_with('/') {
        return None;
    }
    let (options, partial): (Vec<&str>, &str) = match line.split_once(' ') {
        None => (COMMANDS.to_vec(), line),
        Some(("/agent", partial)) => (AGENTS.to_vec(), partial),
        Some(("/permissions", partial)) => (MODES.to_vec(), partial),
        Some(("/effort", partial)) => (EFFORTS.to_vec(), partial),
        Some(("/goal", partial)) => (GOALS.to_vec(), partial),
        Some(("/model", partial)) => (models.iter().map(String::as_str).collect(), partial),
        Some(_) => return None,
    };
    if partial.contains(' ') {
        return None;
    }
    options
        .into_iter()
        .find(|option| option.starts_with(partial) && option.len() > partial.len())
        .map(|option| option[partial.len()..].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn models() -> Vec<String> {
        vec!["gpt-6.1-sol".to_string(), "gpt-6-luna".to_string()]
    }

    #[test]
    fn finishes_commands() {
        assert_eq!(suggest("/mo", &[]), Some("del".to_string()));
        assert_eq!(suggest("/r", &[]), Some("esume".to_string()));
        assert_eq!(suggest("/", &[]), Some("resume".to_string()));
    }

    #[test]
    fn stays_quiet_once_a_command_is_complete_or_unknown() {
        assert_eq!(suggest("/model", &[]), None);
        assert_eq!(suggest("/zz", &[]), None);
        assert_eq!(suggest("fix the /mo", &[]), None);
    }

    #[test]
    fn finishes_agent_and_model_names() {
        assert_eq!(suggest("/agent co", &[]), Some("dex".to_string()));
        assert_eq!(suggest("/permissions y", &[]), Some("olo".to_string()));
        assert_eq!(suggest("/effort xh", &[]), Some("igh".to_string()));
        assert_eq!(suggest("/pe", &[]), Some("rmissions".to_string()));
        assert_eq!(
            suggest("/model gpt-6-", &models()),
            Some("luna".to_string())
        );
        assert_eq!(suggest("/model gpt-6.1-sol", &models()), None);
        assert_eq!(suggest("/help me", &models()), None);
    }
}
