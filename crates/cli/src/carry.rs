use sombre_core::Agent;
pub use sombre_engine::carry::{note, run};

pub enum Choice {
    Move,
    Fresh,
    Cancel,
}

pub fn name(agent: Agent) -> &'static str {
    match agent {
        Agent::Claude => "claude code",
        Agent::Codex => "codex",
        Agent::Sombre => "sombre's agent",
    }
}

pub fn ask(from: Agent, to: Agent) -> Choice {
    let picked = crate::menu::select(format!("bring this chat to {}?", name(to)))
        .item(
            true,
            format!("move it to {}", name(to)),
            "the whole chat comes along. switching back brings it home with everything",
        )
        .item(
            false,
            "start a new chat",
            format!("this one stays in {}", name(from)),
        )
        .interact();
    match picked {
        Ok(true) => Choice::Move,
        Ok(false) => Choice::Fresh,
        Err(_) => Choice::Cancel,
    }
}
