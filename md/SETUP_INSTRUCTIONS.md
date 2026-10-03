# VGUMap Info Data Sync - Setup Instructions

This document provides step-by-step instructions for setting up automated data synchronization for the VGUMap application.

## Overview

The `sync_info_data.js` script automatically fetches room data from a Google Apps Script API endpoint and updates the `info_data.json` file used by the frontend. 

### Key Features

- **Automatic Execution**: Runs every 5 minutes via cron or GitHub Actions
- **Data Validation**: Ensures API response has `status === 'success'` and non-empty `data` array
- **Data Flattening**: Converts `occupants_list` arrays to comma-separated strings (`occupants_flat`)
- **Failsafe Protection**: Never overwrites `info_data.json` if fetched data is invalid/empty
- **Redirect Handling**: Automatically follows Google Apps Script redirects

---

## Option 1: GitHub Actions (Recommended for Static Hosting)

This option is ideal if your project is hosted on GitHub Pages or similar static hosting.

### Setup Steps

1. **Verify the workflow file exists**
   
   The workflow file is already created at `.github/workflows/update_data.yml`

2. **Enable GitHub Actions** (if not already enabled)
   
   - Go to your repository Settings
   - Navigate to "Actions" → "General"
   - Ensure "Allow all actions and reusable workflows" is selected

3. **Verify the workflow configuration**
   
   The workflow runs on:
   - Schedule: Every 5 minutes (`*/5 * * * *`)
   - Manual trigger: Available via "Run workflow" button

4. **Test the workflow**
   
   - Go to Actions tab in your repository
   - Select "Update Info Data" workflow
   - Click "Run workflow" → "Run workflow"
   - Monitor the execution logs

### Workflow Behavior

- Checks out your repository
- Sets up Node.js v20
- Runs `node sync_info_data.js`
- Commits and pushes changes only if `info_data.json` was updated

### Viewing Results

- Check the "Actions" tab for run history
- Successful runs will show a commit like: `chore: auto-update info_data.json [skip ci]`
- Failed runs will NOT modify the existing `info_data.json` file

---

## Option 2: Node.js with PM2 (For VPS/Dedicated Server)

This option is ideal if you have a dedicated server or VPS running 24/7.

### Prerequisites

- Node.js installed (v14 or higher recommended)
- PM2 process manager installed globally

### Setup Steps

1. **Install PM2 globally**
   ```bash
   npm install -g pm2
   ```

2. **Navigate to your project directory**
   ```bash
   cd /path/to/your/project
   ```

3. **Test the script manually**
   ```bash
   node sync_info_data.js
   ```
   
   Expected output should show successful fetch and save operations.

4. **Create a PM2 ecosystem config file** (optional but recommended)
   
   Create `ecosystem.config.js`:
   ```javascript
   module.exports = {
     apps: [{
       name: 'vgumap-info-sync',
       script: 'sync_info_data.js',
       cron_restart: '*/5 * * * *',  // Run every 5 minutes
       autorestart: false,  // Don't restart after cron job completes
       max_restarts: 1,
       min_uptime: 0
     }]
   };
   ```

5. **Start the cron job with PM2**
   
   Using ecosystem file:
   ```bash
   pm2 start ecosystem.config.js
   ```
   
   Or directly with cron:
   ```bash
   pm2 start sync_info_data.js --cron="*/5 * * * *" --name vgumap-info-sync
   ```

6. **Save PM2 configuration** (persists across reboots)
   ```bash
   pm2 save
   pm2 startup
   ```
   
   Follow the command output to enable PM2 on system startup.

7. **Monitor the cron job**
   ```bash
   # View logs
   pm2 logs vgumap-info-sync
   
   # View status
   pm2 status
   
   # View detailed info
   pm2 show vgumap-info-sync
   ```

### Managing the PM2 Job

```bash
# Stop the job
pm2 stop vgumap-info-sync

# Restart the job
pm2 restart vgumap-info-sync

# Delete the job
pm2 delete vgumap-info-sync

# View real-time logs
pm2 logs vgumap-info-sync --lines 100
```

---

## Option 3: Traditional Cron (Linux/Mac Server)

For servers without PM2, use system cron directly.

### Setup Steps

1. **Find the full path to Node.js**
   ```bash
   which node
   # Example output: /usr/bin/node
   ```

2. **Find the full path to your script**
   ```bash
   pwd
   # Example output: /home/user/vgumap-project
   ```

3. **Edit crontab**
   ```bash
   crontab -e
   ```

4. **Add the cron entry**
   ```
   */5 * * * * /usr/bin/node /path/to/your/project/sync_info_data.js >> /path/to/your/project/sync.log 2>&1
   ```
   
   Replace paths with actual values from steps 1-2.

5. **Verify cron is running**
   ```bash
   sudo systemctl status cron    # Debian/Ubuntu
   sudo systemctl status crond   # RHEL/CentOS
   ```

6. **Check logs**
   ```bash
   tail -f /path/to/your/project/sync.log
   ```

---

## Data Structure

### Input (API Response)
```json
{
  "status": "success",
  "data": [
    {
      "room_number": "101",
      "heading_1": "CLASSROOM",
      "heading_2": "PHÒNG HỌC",
      "department": "CS",
      "occupants_list": ["Nguyen Van A", "Le Thi B"],
      ...
    }
  ]
}
```

### Output (info_data.json)
```json
{
  "status": "success",
  "total_rooms": 452,
  "last_updated": "2026-05-12T21:40:35.576Z",
  "data": [
    {
      "room_number": "101",
      "heading_1": "CLASSROOM",
      "heading_2": "PHÒNG HỌC",
      "department": "CS",
      "occupants_list": ["Nguyen Van A", "Le Thi B"],
      "occupants_flat": "Nguyen Van A, Le Thi B",
      "occupant_display": "Nguyen Van A, Le Thi B",
      ...
    }
  ]
}
```

### Key Transformations

| Field | Transformation |
|-------|---------------|
| `occupants_list` | Preserved as original array |
| `occupants_flat` | NEW: Comma-separated string from array |
| `occupant_display` | Updated to match `occupants_flat` when occupants exist |

All other fields are preserved unchanged, including:
- `room_number`
- `heading_1`
- `heading_2`
- `department`
- `area`
- `unbounded_height`
- `capacity`
- `status`
- `is_active`

---

## Error Handling

The script implements robust error handling:

### Validation Checks
1. **Response Status**: Must be exactly `'success'`
2. **Data Array**: Must exist and be an array
3. **Non-Empty**: Data array must contain at least one room

### Failsafe Behavior
- If ANY validation fails, the existing `info_data.json` is NOT modified
- Error messages are logged to console/stderr
- Script exits with code 1 on failure, 0 on success

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `HTTP Error: 404` | Invalid API URL | Check API_ENDPOINTS.INFO URL |
| `JSON Parse Failed` | Malformed response | Contact API provider |
| `Invalid status` | API returned error status | Check Google Sheet source |
| `Data array is empty` | No rooms in source | Verify Google Sheet has data |
| `Request timeout` | Network/API slow | Increase timeout in REQUEST_OPTIONS |

---

## Testing

### Manual Test Run
```bash
node sync_info_data.js
```

### Verify Output
```bash
# Check file was updated
ls -la info_data.json

# View first few rooms
head -50 info_data.json

# Count rooms
grep -c '"room_number"' info_data.json
```

### Test Failsafe (Simulate Failure)
1. Temporarily change API_ENDPOINTS.INFO to an invalid URL
2. Run the script
3. Verify `info_data.json` timestamp did NOT change
4. Restore the correct URL

---

## Troubleshooting

### GitHub Actions Issues

**Problem**: Workflow doesn't run on schedule
- **Solution**: Make a commit or manual trigger to activate scheduled workflows for the first time

**Problem**: Push fails in workflow
- **Solution**: Ensure workflow has write permissions in Settings → Actions → General

**Problem**: Changes don't appear
- **Solution**: Check workflow logs for errors; verify API endpoint is accessible

### PM2 Issues

**Problem**: Cron job doesn't run
- **Solution**: Check `pm2 logs`, verify cron syntax, ensure PM2 is running

**Problem**: Node not found
- **Solution**: Use absolute path to node binary in ecosystem config

### Cron Issues

**Problem**: Job doesn't execute
- **Solution**: Check `/var/log/cron` or `journalctl -u cron`, verify user permissions

**Problem**: Script runs but doesn't update file
- **Solution**: Check file permissions, ensure script has write access

---

## Security Notes

1. **API Endpoint**: The Google Apps Script URL is public. If your data is sensitive, consider adding authentication.

2. **Repository Access**: For GitHub Actions, the workflow commits back to the repository. Ensure branch protection rules allow this.

3. **Rate Limiting**: Running every 5 minutes generates ~288 requests/day. Monitor Google Apps Script quotas.

---

## Support

For issues related to:
- **Script bugs**: Check logs, validate API response format
- **GitHub Actions**: Review GitHub Actions documentation
- **PM2/Cron**: Consult respective tool documentation
- **API/Google Sheets**: Contact the data provider
