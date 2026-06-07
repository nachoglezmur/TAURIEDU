use keyring::Entry;
use serde::{Deserialize, Serialize};

const SERVICE: &str = "ssm-port-manager";

#[derive(Serialize, Deserialize, Clone)]
pub struct Credentials {
    pub key_id: String,
    pub secret: String,
    pub region: String,
}

#[tauri::command]
pub fn save_credentials(key_id: String, secret: String, region: String) -> Result<(), String> {
    Entry::new(SERVICE, "key_id")
        .map_err(|e| e.to_string())?
        .set_password(&key_id)
        .map_err(|e| e.to_string())?;

    Entry::new(SERVICE, "secret")
        .map_err(|e| e.to_string())?
        .set_password(&secret)
        .map_err(|e| e.to_string())?;

    Entry::new(SERVICE, "region")
        .map_err(|e| e.to_string())?
        .set_password(&region)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn load_credentials() -> Result<Credentials, String> {
    let key_id = Entry::new(SERVICE, "key_id")
        .map_err(|e| e.to_string())?
        .get_password()
        .map_err(|_| "No credentials stored".to_string())?;

    let secret = Entry::new(SERVICE, "secret")
        .map_err(|e| e.to_string())?
        .get_password()
        .map_err(|_| "No credentials stored".to_string())?;

    let region = Entry::new(SERVICE, "region")
        .map_err(|e| e.to_string())?
        .get_password()
        .unwrap_or_else(|_| "us-east-1".to_string());

    Ok(Credentials { key_id, secret, region })
}

pub fn get_credentials() -> Option<Credentials> {
    load_credentials().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credentials_struct_accessible() {
        let c = Credentials {
            key_id: "AKIATEST".to_string(),
            secret: "secret123".to_string(),
            region: "us-east-1".to_string(),
        };
        assert_eq!(c.key_id, "AKIATEST");
        assert_eq!(c.secret, "secret123");
        assert_eq!(c.region, "us-east-1");
    }

    #[test]
    fn credentials_serializes_correct_field_names() {
        let c = Credentials {
            key_id: "AKIATEST".to_string(),
            secret: "mysecret".to_string(),
            region: "eu-west-1".to_string(),
        };
        let json = serde_json::to_string(&c).unwrap();
        assert!(json.contains("\"key_id\":\"AKIATEST\""));
        assert!(json.contains("\"secret\":\"mysecret\""));
        assert!(json.contains("\"region\":\"eu-west-1\""));
    }

    #[test]
    fn credentials_deserializes_from_json() {
        let json = r#"{"key_id":"AKIA","secret":"s","region":"ap-southeast-1"}"#;
        let c: Credentials = serde_json::from_str(json).unwrap();
        assert_eq!(c.key_id, "AKIA");
        assert_eq!(c.region, "ap-southeast-1");
    }

    #[test]
    fn credentials_clone() {
        let c = Credentials {
            key_id: "K".to_string(),
            secret: "S".to_string(),
            region: "R".to_string(),
        };
        let c2 = c.clone();
        assert_eq!(c2.key_id, "K");
    }

    #[test]
    fn service_name_constant() {
        assert_eq!(SERVICE, "ssm-port-manager");
    }
}
