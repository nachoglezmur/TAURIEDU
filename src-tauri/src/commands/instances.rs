use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Clone)]
pub struct Instance {
    pub id: String,
    pub name: String,
}

fn instances_file_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("SSMPortManager")
        .join("instances.csv")
}

#[tauri::command]
pub fn get_instances_file_path() -> String {
    instances_file_path().to_string_lossy().to_string()
}

fn parse_instances_csv(content: &str) -> Vec<Instance> {
    content
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.starts_with('#') && l.contains("i-"))
        .map(|line| {
            let mut parts = line.splitn(2, ',');
            let id = parts.next().unwrap_or("").trim().to_string();
            let name = parts
                .next()
                .map(|n| n.trim().to_string())
                .filter(|n| !n.is_empty())
                .unwrap_or_else(|| id.clone());
            Instance { id, name }
        })
        .filter(|i| i.id.starts_with("i-"))
        .collect()
}

#[tauri::command]
pub fn load_instances() -> Result<Vec<Instance>, String> {
    let path = instances_file_path();

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    if !path.exists() {
        fs::write(&path, "").map_err(|e| e.to_string())?;
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;

    Ok(parse_instances_csv(&content))
}

#[cfg(test)]
mod tests {
    use super::parse_instances_csv as parse;

    #[test]
    fn parses_id_and_name() {
        let v = parse("i-0abc123,MyServer");
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].id, "i-0abc123");
        assert_eq!(v[0].name, "MyServer");
    }

    #[test]
    fn defaults_name_to_id_when_no_comma() {
        let v = parse("i-0abc123");
        assert_eq!(v[0].name, "i-0abc123");
    }

    #[test]
    fn defaults_name_to_id_when_empty_after_comma() {
        let v = parse("i-0abc123,");
        assert_eq!(v[0].name, "i-0abc123");
    }

    #[test]
    fn skips_empty_lines() {
        let v = parse("i-0abc,A\n\ni-0def,B");
        assert_eq!(v.len(), 2);
    }

    #[test]
    fn skips_comment_lines() {
        let v = parse("# a comment\ni-0abc,A");
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].id, "i-0abc");
    }

    #[test]
    fn skips_lines_not_starting_with_i_dash() {
        let v = parse("ec2-instance,Bad\ni-0abc,Good");
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].name, "Good");
    }

    #[test]
    fn handles_empty_input() {
        assert_eq!(parse("").len(), 0);
    }

    #[test]
    fn handles_multiple_instances() {
        let v = parse("i-0aaa,A\ni-0bbb,B\ni-0ccc,C");
        assert_eq!(v.len(), 3);
        assert_eq!(v[1].name, "B");
    }

    #[test]
    fn trims_whitespace_around_id_and_name() {
        let v = parse("  i-0abc  ,  MyServer  ");
        assert_eq!(v[0].id, "i-0abc");
        assert_eq!(v[0].name, "MyServer");
    }

    #[test]
    fn name_can_contain_commas_via_splitn() {
        let v = parse("i-0abc,Server, Production");
        assert_eq!(v[0].name, "Server, Production");
    }

    #[test]
    fn instance_file_path_contains_ssm_port_manager() {
        let path = super::instances_file_path();
        let s = path.to_string_lossy();
        assert!(s.contains("SSMPortManager"));
        assert!(s.ends_with("instances.csv"));
    }
}
