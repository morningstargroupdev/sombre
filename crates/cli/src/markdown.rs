#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Span {
    Plain(String),
    Strong(String),
    Emphasis(String),
    Code(String),
    Link(String, String),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Block {
    Heading(Vec<Span>),
    Bullet(String, Vec<Span>),
    Quote(Vec<Span>),
    Fence(String),
    Code(String),
    Rule,
    Blank,
    Text(Vec<Span>),
}

#[derive(Debug, Default)]
pub struct Reader {
    fence: bool,
}

impl Reader {
    pub fn line(&mut self, raw: &str) -> Block {
        let trimmed = raw.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            self.fence = !self.fence;
            return Block::Fence(trimmed.trim_start_matches(['`', '~']).trim().to_string());
        }
        if self.fence {
            return Block::Code(raw.to_string());
        }
        if trimmed.is_empty() {
            return Block::Blank;
        }
        if matches!(trimmed, "---" | "***" | "___") {
            return Block::Rule;
        }
        if let Some(rest) = heading(trimmed) {
            return Block::Heading(spans(rest));
        }
        if let Some(rest) = trimmed.strip_prefix("> ") {
            return Block::Quote(spans(rest));
        }
        let indent = " ".repeat((raw.len() - trimmed.len()).min(8));
        for marker in ["- ", "* ", "+ "] {
            if let Some(rest) = trimmed.strip_prefix(marker) {
                return Block::Bullet(format!("{indent}•"), spans(rest));
            }
        }
        if let Some((number, rest)) = numbered(trimmed) {
            return Block::Bullet(format!("{indent}{number}."), spans(rest));
        }
        Block::Text(spans(raw.trim_end()))
    }
}

fn heading(text: &str) -> Option<&str> {
    let level = text
        .chars()
        .take_while(|character| *character == '#')
        .count();
    if (1..=6).contains(&level) {
        text[level..].strip_prefix(' ')
    } else {
        None
    }
}

fn numbered(text: &str) -> Option<(&str, &str)> {
    let digits = text.chars().take_while(char::is_ascii_digit).count();
    if digits == 0 || digits > 3 {
        return None;
    }
    let rest = text[digits..].strip_prefix(". ")?;
    Some((&text[..digits], rest))
}

pub fn spans(text: &str) -> Vec<Span> {
    let mut found = Vec::new();
    let mut plain = String::new();
    let mut rest = text;
    while let Some(first) = rest.chars().next() {
        let taken = match first {
            '`' => enclosed(rest, "`").map(|(inner, used)| (Span::Code(inner.to_string()), used)),
            '*' if rest.starts_with("**") => {
                enclosed(rest, "**").map(|(inner, used)| (Span::Strong(inner.to_string()), used))
            }
            '_' if rest.starts_with("__") => {
                enclosed(rest, "__").map(|(inner, used)| (Span::Strong(inner.to_string()), used))
            }
            '*' => {
                enclosed(rest, "*").map(|(inner, used)| (Span::Emphasis(inner.to_string()), used))
            }
            '[' => link(rest),
            _ => None,
        };
        match taken {
            Some((span, used)) => {
                if !plain.is_empty() {
                    found.push(Span::Plain(std::mem::take(&mut plain)));
                }
                found.push(span);
                rest = &rest[used..];
            }
            None => {
                plain.push(first);
                rest = &rest[first.len_utf8()..];
            }
        }
    }
    if !plain.is_empty() {
        found.push(Span::Plain(plain));
    }
    found
}

fn enclosed<'a>(text: &'a str, mark: &str) -> Option<(&'a str, usize)> {
    let body = text.strip_prefix(mark)?;
    let end = body.find(mark)?;
    let inner = &body[..end];
    if inner.is_empty() || inner.starts_with(' ') || inner.ends_with(' ') {
        return None;
    }
    Some((inner, mark.len() * 2 + end))
}

fn link(text: &str) -> Option<(Span, usize)> {
    let close = text.find("](")?;
    let label = &text[1..close];
    let after = &text[close + 2..];
    let end = after.find(')')?;
    let url = &after[..end];
    if label.is_empty() || url.contains(' ') {
        return None;
    }
    Some((
        Span::Link(label.to_string(), url.to_string()),
        close + 2 + end + 1,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn plain(text: &str) -> Span {
        Span::Plain(text.to_string())
    }

    #[test]
    fn reads_inline_styles() {
        assert_eq!(
            spans("run `bun test` and **check** the *output*"),
            vec![
                plain("run "),
                Span::Code("bun test".to_string()),
                plain(" and "),
                Span::Strong("check".to_string()),
                plain(" the "),
                Span::Emphasis("output".to_string()),
            ]
        );
    }

    #[test]
    fn reads_links() {
        assert_eq!(
            spans("see [the docs](https://sombre.ai/docs) now"),
            vec![
                plain("see "),
                Span::Link("the docs".to_string(), "https://sombre.ai/docs".to_string()),
                plain(" now"),
            ]
        );
    }

    #[test]
    fn leaves_lone_markers_alone() {
        assert_eq!(spans("2 * 3 = 6"), vec![plain("2 * 3 = 6")]);
        assert_eq!(spans("a `b"), vec![plain("a `b")]);
        assert_eq!(
            spans("é **ü**"),
            vec![plain("é "), Span::Strong("ü".to_string())]
        );
    }

    #[test]
    fn reads_blocks() {
        let mut reader = Reader::default();
        assert_eq!(reader.line("## Plan"), Block::Heading(vec![plain("Plan")]));
        assert_eq!(
            reader.line("- first"),
            Block::Bullet("•".to_string(), vec![plain("first")])
        );
        assert_eq!(
            reader.line("  * nested"),
            Block::Bullet("  •".to_string(), vec![plain("nested")])
        );
        assert_eq!(
            reader.line("12. twelfth"),
            Block::Bullet("12.".to_string(), vec![plain("twelfth")])
        );
        assert_eq!(reader.line("> quoted"), Block::Quote(vec![plain("quoted")]));
        assert_eq!(reader.line("---"), Block::Rule);
        assert_eq!(reader.line("   "), Block::Blank);
    }

    #[test]
    fn keeps_code_fences_verbatim() {
        let mut reader = Reader::default();
        assert_eq!(reader.line("```rust"), Block::Fence("rust".to_string()));
        assert_eq!(
            reader.line("    let x = **y**;"),
            Block::Code("    let x = **y**;".to_string())
        );
        assert_eq!(
            reader.line("- not a bullet"),
            Block::Code("- not a bullet".to_string())
        );
        assert_eq!(reader.line("```"), Block::Fence(String::new()));
        assert_eq!(
            reader.line("- a bullet"),
            Block::Bullet("•".to_string(), vec![plain("a bullet")])
        );
    }
}
