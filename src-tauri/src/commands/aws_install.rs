use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct DependencyStatus {
    pub aws_cli: bool,
    pub ssm_plugin: bool,
}

#[tauri::command]
pub fn check_dependencies() -> DependencyStatus {
    let aws_cli = Command::new("aws")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let ssm_plugin = std::path::Path::new(
        r"C:\Program Files\Amazon\SessionManagerPlugin\bin\session-manager-plugin.exe",
    )
    .exists();

    DependencyStatus { aws_cli, ssm_plugin }
}

#[tauri::command]
pub async fn install_aws_cli() -> Result<(), String> {
    // Try winget first
    let winget = Command::new("winget")
        .args([
            "install",
            "--id",
            "Amazon.AWSCLI",
            "--silent",
            "--accept-package-agreements",
            "--accept-source-agreements",
        ])
        .output();

    if let Ok(out) = winget {
        if out.status.success() {
            return Ok(());
        }
    }

    // Fallback: PowerShell MSI download
    let ps = r#"
$msiUrl = 'https://awscli.amazonaws.com/AWSCLIV2.msi'
$msiPath = "$env:TEMP\AWSCLIV2.msi"
Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath -UseBasicParsing
Start-Process msiexec.exe -Wait -ArgumentList '/i', $msiPath, '/qn'
Remove-Item $msiPath -Force
"#;

    let out = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", ps])
        .output()
        .map_err(|e| e.to_string())?;

    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
    }
}

#[tauri::command]
pub async fn install_ssm_plugin() -> Result<(), String> {
    let ps = r#"
$url = 'https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPluginSetup.exe'
$installer = "$env:TEMP\SessionManagerPluginSetup.exe"
Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing
Start-Process -FilePath $installer -ArgumentList '/S' -Verb RunAs -Wait
Remove-Item $installer -Force
"#;

    let out = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", ps])
        .output()
        .map_err(|e| e.to_string())?;

    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dependency_status_fields() {
        let s = DependencyStatus { aws_cli: true, ssm_plugin: false };
        assert!(s.aws_cli);
        assert!(!s.ssm_plugin);
    }

    #[test]
    fn dependency_status_serializes_with_correct_keys() {
        let s = DependencyStatus { aws_cli: true, ssm_plugin: false };
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("\"aws_cli\":true"));
        assert!(json.contains("\"ssm_plugin\":false"));
    }

    #[test]
    fn dependency_status_both_false() {
        let s = DependencyStatus { aws_cli: false, ssm_plugin: false };
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("\"aws_cli\":false"));
        assert!(json.contains("\"ssm_plugin\":false"));
    }

    #[test]
    fn ssm_plugin_path_has_correct_filename() {
        let path = std::path::Path::new(
            r"C:\Program Files\Amazon\SessionManagerPlugin\bin\session-manager-plugin.exe",
        );
        assert_eq!(path.file_name().unwrap().to_str().unwrap(), "session-manager-plugin.exe");
    }

    #[test]
    fn ssm_plugin_path_under_program_files_amazon() {
        let path = std::path::Path::new(
            r"C:\Program Files\Amazon\SessionManagerPlugin\bin\session-manager-plugin.exe",
        );
        assert!(path.to_string_lossy().contains("Program Files"));
        assert!(path.to_string_lossy().contains("Amazon"));
    }
}
