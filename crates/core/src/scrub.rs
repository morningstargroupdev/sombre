use std::iter::Peekable;
use std::str::Chars;

fn sequence(characters: &mut Peekable<Chars<'_>>, kind: char) {
    match kind {
        '[' => {
            for code in characters.by_ref() {
                if ('@'..='~').contains(&code) {
                    break;
                }
            }
        }
        ']' | 'P' | 'X' | '^' | '_' => {
            while let Some(code) = characters.next() {
                if code == '\u{7}' || code == '\u{9c}' {
                    break;
                }
                if code == '\u{1b}' && characters.peek() == Some(&'\\') {
                    characters.next();
                    break;
                }
            }
        }
        '(' | ')' | '*' | '+' | '#' | '%' => {
            characters.next();
        }
        _ => {}
    }
}

pub fn scrub(text: &str) -> String {
    let mut kept = String::with_capacity(text.len());
    let mut characters = text.chars().peekable();
    while let Some(character) = characters.next() {
        match character {
            '\u{1b}' => {
                if let Some(kind) = characters.next() {
                    sequence(&mut characters, kind);
                }
            }
            '\u{9b}' => sequence(&mut characters, '['),
            '\u{9d}' => sequence(&mut characters, ']'),
            '\u{90}' | '\u{98}' | '\u{9e}' | '\u{9f}' => sequence(&mut characters, 'P'),
            '\n' => kept.push('\n'),
            '\t' => kept.push_str("    "),
            '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}' => {}
            other if other.is_control() => {}
            other => kept.push(other),
        }
    }
    kept
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drops_escape_sequences_and_keeps_the_text() {
        assert_eq!(scrub("\u{1b}[31mred\u{1b}[0m done"), "red done");
        assert_eq!(scrub("before\u{1b}[2J\u{1b}[Hafter"), "beforeafter");
        assert_eq!(scrub("\u{1b}]52;c;aGk=\u{7}copied"), "copied");
        assert_eq!(
            scrub("\u{1b}]8;;https://x.y\u{1b}\\link\u{1b}]8;;\u{1b}\\"),
            "link"
        );
        assert_eq!(scrub("\u{1b}creset"), "reset");
        assert_eq!(scrub("\u{9b}2Jc1"), "c1");
    }

    #[test]
    fn keeps_lines_and_drops_other_controls() {
        assert_eq!(scrub("one\r\ntwo\u{7}\u{8}\u{7f}"), "one\ntwo");
        assert_eq!(scrub("a\tb"), "a    b");
        assert_eq!(scrub("safe \u{202e}txt.exe"), "safe txt.exe");
        assert_eq!(scrub("日本語 ✓"), "日本語 ✓");
    }
}
