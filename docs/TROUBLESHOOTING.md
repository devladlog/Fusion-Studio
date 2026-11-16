# Fusion Studio - Troubleshooting Guide

> **Solutions to common issues and how to get help**

---

## Quick Diagnostics

```mermaid
flowchart TD
    START[Issue Encountered] --> Q1{Extension<br/>Activated?}
    
    Q1 -->|No| S1[Reload Window<br/>Ctrl+Shift+P > Reload]
    Q1 -->|Yes| Q2{PAC<br/>Authenticated?}
    
    Q2 -->|No| S2[Run: pac auth create]
    Q2 -->|Yes| Q3{AI Features<br/>Working?}
    
    Q3 -->|No| S3[Check API Key<br/>& Settings]
    Q3 -->|Yes| Q4{Dataverse<br/>Connected?}
    
    Q4 -->|No| S4[Check Environment<br/>URL & Permissions]
    Q4 -->|Yes| Q5{Still<br/>Issues?}
    
    Q5 -->|Yes| S5[Check Output Panel<br/>View > Output > Fusion Studio]
    Q5 -->|No| DONE[Issue Resolved!]
    
    S1 --> Q1
    S2 --> Q2
    S3 --> Q3
    S4 --> Q4
    S5 --> REPORT[Report Issue on GitHub]
```

---

## Common Issues

### 1. Extension Not Activating

```mermaid
flowchart LR
    SYMPTOM[No Fusion Studio<br/>commands available] --> CHECK1[Check VS Code version]
    CHECK1 --> CHECK2[Check extension installed]
    CHECK2 --> CHECK3[Check Output panel]
    CHECK3 --> FIX[Apply fix]
```

**Symptoms:**
- Commands not appearing in palette
- No Fusion Studio tree views
- Dashboard doesn't open

**Solutions:**

| Step | Action |
|------|--------|
| 1 | Verify VS Code version is 1.85+ |
| 2 | Reload window: `Ctrl+Shift+P` > "Reload Window" |
| 3 | Check Output panel for errors: View > Output > Fusion Studio |
| 4 | Reinstall extension if needed |
| 5 | Check for conflicting extensions |

**Quick Fix:**
```
1. Press Ctrl+Shift+P
2. Type "Reload Window"
3. Press Enter
```

---

### 2. PAC Authentication Failed

```mermaid
sequenceDiagram
    participant U as User
    participant PAC as PAC CLI
    participant AAD as Azure AD
    
    U->>PAC: pac auth create
    PAC->>AAD: Request authentication
    AAD-->>U: Browser popup
    U->>AAD: Sign in
    
    alt Success
        AAD-->>PAC: Token received
        PAC-->>U: Authentication successful
    else Failure
        AAD-->>PAC: Error
        PAC-->>U: Authentication failed
    end
```

**Symptoms:**
- "Not authenticated" errors
- Environment list empty
- Studio won't load

**Solutions:**

```powershell
# Step 1: Clear existing auth
pac auth clear

# Step 2: Create new auth
pac auth create --environment https://your-org.crm.dynamics.com

# Step 3: Verify
pac auth list
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Expired token | Run `pac auth create` again |
| Wrong environment | Use correct environment URL |
| MFA required | Complete MFA in browser |
| Firewall blocking | Check corporate firewall settings |
| VPN issues | Connect to VPN or whitelist URLs |

---

### 3. AI Features Not Working

```mermaid
flowchart TD
    AI_ERROR[AI Error] --> CHECK_KEY{API Key<br/>Set?}
    
    CHECK_KEY -->|No| SET_KEY[Set API Key<br/>Command: Set Azure OpenAI API Key]
    CHECK_KEY -->|Yes| CHECK_ENDPOINT{Endpoint<br/>Configured?}
    
    CHECK_ENDPOINT -->|No| SET_ENDPOINT[Configure in Settings<br/>fusionStudio.azureOpenAi.endpoint]
    CHECK_ENDPOINT -->|Yes| CHECK_DEPLOY{Deployment<br/>Name Set?}
    
    CHECK_DEPLOY -->|No| SET_DEPLOY[Configure in Settings<br/>fusionStudio.azureOpenAi.deploymentName]
    CHECK_DEPLOY -->|Yes| CHECK_QUOTA{Quota<br/>Available?}
    
    CHECK_QUOTA -->|No| WAIT[Wait and retry<br/>or increase quota]
    CHECK_QUOTA -->|Yes| CHECK_MODEL{Model<br/>Supports Feature?}
    
    CHECK_MODEL -->|No| USE_GPT4[Use GPT-4 or GPT-4o<br/>for vision features]
    CHECK_MODEL -->|Yes| CONTACT[Check Azure OpenAI status<br/>or contact support]
```

**Symptoms:**
- "API key not configured" error
- "Request failed" errors
- Empty AI responses
- Mockup analysis fails

**Required Settings:**

```json
{
  "fusionStudio.azureOpenAi.endpoint": "https://YOUR-RESOURCE.openai.azure.com",
  "fusionStudio.azureOpenAi.deploymentName": "gpt-4",
  "fusionStudio.azureOpenAi.apiVersion": "2024-02-15-preview"
}
```

**Set API Key:**
```
1. Press Ctrl+Shift+P
2. Type "Set Azure OpenAI API Key"
3. Enter your API key when prompted
```

**Troubleshooting Checklist:**

| Check | How to Verify |
|-------|---------------|
| Endpoint URL | Must start with `https://` and end with `.openai.azure.com` |
| Deployment name | Must match your Azure OpenAI deployment |
| API key | 32-character key from Azure portal |
| Model capabilities | GPT-4 Vision for mockup analysis |
| Quota | Check Azure portal for usage limits |

---

### 4. Dataverse Connection Error

```mermaid
flowchart TD
    DV_ERROR[Dataverse Error] --> CHECK_AUTH{PAC<br/>Authenticated?}
    
    CHECK_AUTH -->|No| AUTH[Run pac auth create]
    CHECK_AUTH -->|Yes| CHECK_ENV{Environment<br/>Correct?}
    
    CHECK_ENV -->|No| SELECT_ENV[Select correct environment<br/>in tree view]
    CHECK_ENV -->|Yes| CHECK_PERMS{User Has<br/>Permissions?}
    
    CHECK_PERMS -->|No| GET_PERMS[Request Dataverse<br/>permissions from admin]
    CHECK_PERMS -->|Yes| RESET[Reset Dataverse Client<br/>Command Palette]
```

**Symptoms:**
- "Connection refused" errors
- Tables not loading
- "Permission denied" errors
- Create table fails

**Solutions:**

| Issue | Solution |
|-------|----------|
| Connection refused | Check VPN/firewall, verify URL |
| Permission denied | Request System Administrator or Customizer role |
| Token expired | Re-authenticate with PAC CLI |
| Wrong environment | Select correct environment in tree view |

**Reset Client:**
```
1. Press Ctrl+Shift+P
2. Type "Reset Dataverse Client"
3. Try operation again
```

---

### 5. Studio WebView Issues

```mermaid
flowchart TD
    STUDIO_ERROR[Studio Issue] --> CHECK_VERSION{VS Code<br/>Version OK?}
    
    CHECK_VERSION -->|No| UPDATE[Update VS Code<br/>to version 1.85+]
    CHECK_VERSION -->|Yes| CHECK_CSP{CSP<br/>Violations?}
    
    CHECK_CSP -->|Yes| CLEAR_CACHE[Clear WebView cache<br/>Reload extension]
    CHECK_CSP -->|No| CHECK_NETWORK{Network<br/>Issues?}
    
    CHECK_NETWORK -->|Yes| CHECK_PROXY[Check proxy settings<br/>and firewall]
    CHECK_NETWORK -->|No| DEVTOOLS[Open DevTools<br/>F12 in WebView]
```

**Symptoms:**
- Blank WebView panel
- Studio not loading
- Controls not rendering
- Session keeps resetting

**Solutions:**

1. **Reload WebView:**
   ```
   Right-click on WebView panel > Reload WebView
   ```

2. **Check Developer Tools:**
   ```
   Right-click on WebView > Open Developer Tools
   Look for errors in Console tab
   ```

3. **Clear Cache:**
   ```
   Ctrl+Shift+P > "Developer: Reload Window"
   ```

4. **Check Network:**
   - Ensure access to `*.powerapps.com`
   - Ensure access to `*.dynamics.com`
   - Check proxy settings in VS Code

---

### 6. Git Integration Issues

```mermaid
flowchart TD
    GIT_ERROR[Git Error] --> CHECK_INSTALL{Git<br/>Installed?}
    
    CHECK_INSTALL -->|No| INSTALL[Install Git<br/>git-scm.com]
    CHECK_INSTALL -->|Yes| CHECK_INIT{Repo<br/>Initialized?}
    
    CHECK_INIT -->|No| INIT[Run: git init<br/>or use command]
    CHECK_INIT -->|Yes| CHECK_REMOTE{Remote<br/>Configured?}
    
    CHECK_REMOTE -->|No| ADD_REMOTE[Add remote:<br/>git remote add origin URL]
    CHECK_REMOTE -->|Yes| CHECK_CREDS{Credentials<br/>Configured?}
    
    CHECK_CREDS -->|No| CONFIG[Configure Git credentials<br/>or use SSH]
    CHECK_CREDS -->|Yes| CHECK_PERMS{Repo<br/>Permissions?}
```

**Symptoms:**
- "Git not found" error
- Push/pull fails
- Commit messages not generated
- File watcher not detecting changes

**Solutions:**

| Issue | Solution |
|-------|----------|
| Git not found | Install Git and add to PATH |
| Not a repository | Run `git init` in workspace |
| No remote | Add remote with `git remote add origin URL` |
| Authentication | Configure SSH key or credential manager |
| Permission denied | Check repository access rights |

---

### 7. File Watcher Issues

```mermaid
flowchart LR
    FW[File Watcher] --> CHECK{Status?}
    CHECK -->|Not Running| START[Start: Toggle File Watcher command]
    CHECK -->|Running| VERIFY[Verify path configured]
    VERIFY --> TEST[Make a change and save]
    TEST --> OBSERVE[Check diagnostics panel]
```

**Symptoms:**
- Changes not detected
- Lint results not updating
- Sync notifications missing

**Solutions:**

1. **Check Watcher Status:**
   - Look at status bar for watcher indicator
   - Run "Toggle File Watcher" command

2. **Verify Configuration:**
   ```json
   {
     "fusionStudio.autoWatch": true,
     "fusionStudio.watchDebounce": 500
   }
   ```

3. **System Limits (Linux/Mac):**
   ```bash
   # Increase file watcher limit
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

---

## Error Codes Reference

| Code | Description | Solution |
|------|-------------|----------|
| `PAC_AUTH_001` | Not authenticated | Run `pac auth create` |
| `PAC_AUTH_002` | Token expired | Re-authenticate |
| `PAC_ENV_001` | Environment not found | Check environment URL |
| `PAC_ENV_002` | Environment access denied | Request access from admin |
| `DV_CONN_001` | Connection refused | Check firewall/VPN |
| `DV_CONN_002` | Connection timeout | Check network, retry |
| `DV_PERM_001` | Permission denied | Request Dataverse role |
| `DV_SCHEMA_001` | Invalid schema | Check table/column names |
| `AI_KEY_001` | API key not set | Set API key via command |
| `AI_KEY_002` | Invalid API key | Verify key in Azure portal |
| `AI_ENDPOINT_001` | Endpoint not configured | Set endpoint in settings |
| `AI_ENDPOINT_002` | Endpoint unreachable | Check URL and network |
| `AI_QUOTA_001` | Rate limited | Wait and retry |
| `AI_QUOTA_002` | Quota exceeded | Increase quota in Azure |
| `AI_MODEL_001` | Model not found | Check deployment name |
| `GIT_NOT_FOUND` | Git not installed | Install Git |
| `GIT_NO_REPO` | Not a git repository | Run `git init` |
| `GIT_AUTH_001` | Authentication failed | Configure credentials |

---

## Debug Mode

Enable verbose logging to diagnose issues:

```json
// settings.json
{
  "fusionStudio.debug": true,
  "fusionStudio.logLevel": "debug"
}
```

### Viewing Logs

1. Open Output panel: View > Output
2. Select "Fusion Studio" from dropdown
3. Review log messages

### Log Levels

| Level | Description |
|-------|-------------|
| `error` | Only errors |
| `warn` | Errors and warnings |
| `info` | Normal operation messages |
| `debug` | Verbose debugging information |

---

## Getting Help

### Self-Service Resources

```mermaid
flowchart LR
    ISSUE[Have Issue] --> DOCS[Check Documentation]
    DOCS --> SEARCH[Search GitHub Issues]
    SEARCH --> REPORT[Report New Issue]
```

1. **Documentation:**
   - [USER-GUIDE.md](USER-GUIDE.md) - Complete user guide
   - [FEATURES.md](FEATURES.md) - Feature reference
   - [ARCHITECTURE.md](ARCHITECTURE.md) - Technical details

2. **GitHub Issues:**
   - Search existing issues: [Issues](https://github.com/devladlog/Fusion-Studio/issues)
   - Check closed issues for solutions

3. **Questions:**
   - Open an issue: [New issue](https://github.com/devladlog/Fusion-Studio/issues/new/choose)

### Reporting Issues

When reporting an issue, include:

```markdown
**Environment:**
- VS Code Version: 
- Extension Version: 
- OS: 
- PAC CLI Version: 

**Problem:**
[Description of the issue]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Logs:**
[Paste relevant logs from Output panel]

**Screenshots:**
[If applicable]
```

### Collecting Diagnostic Info

```powershell
# Get VS Code version
code --version

# Get PAC CLI version
pac --version

# Get extension version
# Found in Extensions panel > Fusion Studio > Details
```

---

## Quick Fixes Summary

```mermaid
flowchart TB
    subgraph QuickFixes["Quick Fixes"]
        F1["🔄 Reload Window<br/>Ctrl+Shift+P > Reload"]
        F2["🔑 Re-authenticate<br/>pac auth create"]
        F3["⚙️ Check Settings<br/>Ctrl+,"]
        F4["📋 View Logs<br/>View > Output"]
        F5["🔧 Reset Services<br/>Reset Dataverse Client"]
    end
```

| Issue | Quick Fix |
|-------|-----------|
| Extension not working | Reload Window |
| Auth issues | `pac auth create` |
| AI not working | Check API key and settings |
| Dataverse errors | Reset Dataverse Client |
| Studio blank | Reload WebView |
| Git errors | Verify Git installation |
| File watcher | Toggle File Watcher |

---

*Fusion Studio v0.4.2 - Troubleshooting Guide*
