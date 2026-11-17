use std::path::Path;

use crate::view;

type Step = (String, String);

#[derive(Default)]
pub struct Streak {
    steps: Vec<Step>,
}

pub fn counts(steps: &[Step]) -> Vec<(String, usize)> {
    let mut counts: Vec<(String, usize)> = Vec::new();
    for (label, _) in steps {
        match counts.iter_mut().find(|(seen, _)| seen == label) {
            Some((_, count)) => *count += 1,
            None => counts.push((label.clone(), 1)),
        }
    }
    counts
}

impl Streak {
    pub fn push(&mut self, label: &str, detail: &str) {
        self.steps.push((label.to_string(), detail.to_string()));
    }

    pub fn split(&mut self, keep: bool) -> (Vec<Step>, Option<Step>) {
        let mut steps = std::mem::take(&mut self.steps);
        let current = if keep { steps.pop() } else { None };
        (steps, current)
    }

    pub fn rows(&self, cwd: &Path) -> Vec<String> {
        match self.steps.split_last() {
            None => Vec::new(),
            Some(((label, detail), [])) => vec![view::row(label, detail, cwd)],
            Some(((label, detail), [(first, said)])) => {
                vec![view::row(first, said, cwd), view::row(label, detail, cwd)]
            }
            Some(((label, detail), before)) => {
                vec![
                    view::tallied(&counts(before)),
                    view::row(label, detail, cwd),
                ]
            }
        }
    }

    pub fn show(&self, cwd: &Path) {
        if !self.steps.is_empty() {
            view::live(&self.rows(cwd));
        }
    }

    pub fn settle(&mut self, keep: bool, cwd: &Path) {
        let (before, current) = self.split(keep);
        match before.as_slice() {
            [] => {}
            [(label, detail)] => view::step(label, detail, cwd),
            many => view::tally(&counts(many)),
        }
        if let Some((label, detail)) = current {
            view::step(&label, &detail, cwd);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn streak(labels: &[&str]) -> Streak {
        let mut streak = Streak::default();
        for (index, label) in labels.iter().enumerate() {
            streak.push(label, &format!("detail {index}"));
        }
        streak
    }

    #[test]
    fn shows_earlier_steps_as_a_tally_above_the_one_running() {
        let cwd = Path::new("/tmp");
        assert!(Streak::default().rows(cwd).is_empty());
        let one = streak(&["Run"]).rows(cwd);
        assert_eq!(one.len(), 1);
        assert!(one[0].contains("detail 0"));
        let two = streak(&["Read", "Run"]).rows(cwd);
        assert!(two[0].contains("detail 0") && !two[0].contains('×'));
        let three = streak(&["Read", "Read", "Run"]).rows(cwd);
        assert_eq!(three.len(), 2);
        assert!(three[0].contains("×2") && three[1].contains("detail 2"));
    }

    #[test]
    fn counts_labels_in_the_order_they_first_ran() {
        let (before, current) = streak(&["Web", "Search", "Web", "Web", "Search"]).split(false);
        assert_eq!(current, None);
        assert_eq!(
            counts(&before),
            [("Web".to_string(), 3), ("Search".to_string(), 2)]
        );
    }

    #[test]
    fn keeps_the_current_step_apart_when_it_has_output() {
        let (before, current) = streak(&["Read", "Read", "Run"]).split(true);
        assert_eq!(counts(&before), [("Read".to_string(), 2)]);
        assert_eq!(current, Some(("Run".to_string(), "detail 2".to_string())));
        let mut empty = Streak::default();
        assert_eq!(empty.split(true), (Vec::new(), None));
    }
}
