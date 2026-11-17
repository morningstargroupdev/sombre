use std::f64::consts::PI;

const ROWS: usize = 3;
const COLUMNS: usize = 9;
const RAYS: usize = 5;
const INNER: f64 = 3.0;
const OUTER: f64 = 9.5;

pub fn lines() -> Vec<String> {
    let width = COLUMNS * 2;
    let height = ROWS * 4;
    let mut dots = vec![vec![false; width]; height];
    let horizon = height - 1;
    let center = (width as f64 - 1.0) / 2.0;
    let base = horizon as f64 - 1.0;
    dots[horizon].fill(true);
    for ray in 0..RAYS {
        let turn = PI + PI * (ray as f64 + 1.0) / (RAYS as f64 + 1.0);
        if turn.cos() > 1e-9 {
            continue;
        }
        for step in 0..=80 {
            let distance = INNER + (OUTER - INNER) * f64::from(step) / 80.0;
            let x = (center + distance * turn.cos() + 0.5).floor();
            let y = (base + distance * turn.sin()).round();
            if x >= 0.0 && y >= 0.0 && (x as usize) < width && (y as usize) < height {
                let (column, row) = (x as usize, y as usize);
                dots[row][column] = true;
                dots[row][width - 1 - column] = true;
            }
        }
    }
    (0..ROWS)
        .map(|row| {
            (0..COLUMNS)
                .map(|column| braille(&dots, row * 4, column * 2))
                .collect()
        })
        .collect()
}

fn braille(dots: &[Vec<bool>], top: usize, left: usize) -> char {
    const BITS: [(usize, usize, u32); 8] = [
        (0, 0, 0x01),
        (0, 1, 0x02),
        (0, 2, 0x04),
        (1, 0, 0x08),
        (1, 1, 0x10),
        (1, 2, 0x20),
        (0, 3, 0x40),
        (1, 3, 0x80),
    ];
    let code = BITS
        .iter()
        .filter(|(dx, dy, _)| dots[top + dy][left + dx])
        .fold(0x2800, |code, (_, _, bit)| code | bit);
    char::from_u32(code).unwrap_or(' ')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn draws_a_fixed_size_mark() {
        let mark = lines();
        assert_eq!(mark.len(), ROWS);
        assert!(mark.iter().all(|line| line.chars().count() == COLUMNS));
    }

    #[test]
    fn rests_on_an_unbroken_horizon() {
        let mark = lines();
        let bottom = mark.last().map(String::as_str).unwrap_or_default();
        assert!(bottom.chars().all(|cell| (cell as u32) & 0xC0 != 0));
    }

    #[test]
    fn has_rays_above_the_horizon() {
        let mark = lines();
        assert!(mark[0].chars().any(|cell| cell != '\u{2800}'));
    }

    #[test]
    fn is_symmetric() {
        let mark = lines();
        let mirror = |cell: char| {
            let bits = cell as u32 - 0x2800;
            let left = bits & 0x07 | (bits & 0x40) >> 6 << 3;
            let right = (bits & 0x38) >> 3 | (bits & 0x80) >> 7 << 3;
            (left, right)
        };
        for line in &mark {
            let cells: Vec<(u32, u32)> = line.chars().map(mirror).collect();
            for (index, (left, right)) in cells.iter().enumerate() {
                let (other_left, other_right) = cells[cells.len() - 1 - index];
                assert_eq!((*left, *right), (other_right, other_left));
            }
        }
    }
}
