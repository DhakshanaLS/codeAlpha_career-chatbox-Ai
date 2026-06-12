# server.ps1 - Zero-dependency PowerShell Web Server using .NET HttpListener
# Replaces server.js in environments lacking Node.js or Python

$port = 3000
$workspace = "C:\Users\ELCOT\.gemini\antigravity\scratch\ai-chatbot-designer"
$dbFile = Join-Path $workspace "database.json"

# Initialize database if not exists
if (-not (Test-Path $dbFile)) {
    $initialDb = @{
        intents = @()
        leads = @()
        transcripts = @()
    }
    $initialDb | ConvertTo-Json -Depth 10 | Out-File -FilePath $dbFile -Encoding utf8
    Write-Host "[DB] Initialized database.json"
}

# Load database helper function
function Get-Database {
    if (Test-Path $dbFile) {
        $content = Get-Content -Raw -Path $dbFile -ErrorAction SilentlyContinue
        if ($content) {
            $parsed = $content | ConvertFrom-Json
            # Ensure elements are arrays
            if (-not $parsed.intents) { $parsed.intents = @() }
            if (-not $parsed.leads) { $parsed.leads = @() }
            if (-not $parsed.transcripts) { $parsed.transcripts = @() }
            return $parsed
        }
    }
    return @{ intents = @(); leads = @(); transcripts = @() }
}

# Save database helper function
function Save-Database($db) {
    # Ensure properties are properly formatted arrays
    $cleanDb = @{
        intents = @($db.intents)
        leads = @($db.leads)
        transcripts = @($db.transcripts)
    }
    $json = $cleanDb | ConvertTo-Json -Depth 10
    $json | Out-File -FilePath $dbFile -Encoding utf8
}

# Start HTTP Listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try {
    $listener.Start()
    Write-Host "===================================================="
    Write-Host "🚀 ChatStudio PowerShell Web Console Server is running!"
    Write-Host "👉 Access URL: http://localhost:$port/"
    Write-Host "💾 JSON Database: $dbFile"
    Write-Host "===================================================="
    Write-Host "Press Ctrl+C in terminal to stop the server."
} catch {
    Write-Error "Failed to start listener on port $port. Is it already in use?"
    Write-Error $_
    exit
}

# MIME Types mapping
$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css" = "text/css; charset=utf-8"
    ".js" = "text/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png" = "image/png"
    ".jpg" = "image/jpeg"
    ".gif" = "image/gif"
    ".svg" = "image/svg+xml; charset=utf-8"
    ".ico" = "image/x-icon"
}

# Main event loop
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $url = $request.RawUrl
        # Strip query string
        if ($url -match "\?") {
            $url = $url.Substring(0, $url.IndexOf("?"))
        }

        # Enable CORS headers for all responses
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        # Check REST API calls
        if ($url.StartsWith("/api/")) {
            $response.ContentType = "application/json; charset=utf-8"
            
            if ($url -eq "/api/status" -and $request.HttpMethod -eq "GET") {
                $statusData = @{ status = "online"; dbSize = (Get-Item $dbFile).Length }
                $buffer = [System.Text.Encoding]::UTF8.GetBytes(($statusData | ConvertTo-Json))
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            elseif ($url -eq "/api/intents") {
                $db = Get-Database
                if ($request.HttpMethod -eq "GET") {
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes(($db.intents | ConvertTo-Json -Depth 10))
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                }
                elseif ($request.HttpMethod -eq "POST") {
                    $reader = New-Object System.IO.StreamReader($request.InputStream)
                    $body = $reader.ReadToEnd()
                    $newIntent = $body | ConvertFrom-Json
                    
                    $db.intents = @($db.intents) + $newIntent
                    Save-Database $db
                    
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes(($newIntent | ConvertTo-Json -Depth 10))
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                }
            }
            elseif ($url -eq "/api/leads") {
                $db = Get-Database
                if ($request.HttpMethod -eq "GET") {
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes(($db.leads | ConvertTo-Json -Depth 10))
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                }
                elseif ($request.HttpMethod -eq "POST") {
                    $reader = New-Object System.IO.StreamReader($request.InputStream)
                    $body = $reader.ReadToEnd()
                    $newLead = $body | ConvertFrom-Json
                    
                    $db.leads = @($db.leads) + $newLead
                    Save-Database $db
                    
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes(($newLead | ConvertTo-Json -Depth 10))
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                }
            }
            elseif ($url -eq "/api/transcripts") {
                $db = Get-Database
                if ($request.HttpMethod -eq "GET") {
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes(($db.transcripts | ConvertTo-Json -Depth 10))
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                }
                elseif ($request.HttpMethod -eq "POST") {
                    $reader = New-Object System.IO.StreamReader($request.InputStream)
                    $body = $reader.ReadToEnd()
                    $newTranscript = $body | ConvertFrom-Json
                    
                    $db.transcripts = @($db.transcripts) + $newTranscript
                    Save-Database $db
                    
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes(($newTranscript | ConvertTo-Json -Depth 10))
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                }
            }
            else {
                $response.StatusCode = 404
                $err = @{ error = "API endpoint not found" }
                $buffer = [System.Text.Encoding]::UTF8.GetBytes(($err | ConvertTo-Json))
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            $response.Close()
            continue
        }

        # Static file routing
        $fileName = if ($url -eq "/") { "index.html" } else { $url.Substring(1) }
        $filePath = Join-Path $workspace $fileName

        # Resolve directory traversal and check existence
        if ((Test-Path $filePath) -and -not (Test-Path -Path $filePath -PathType Container)) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $response.ContentType = $contentType
            
            $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
        } else {
            $response.StatusCode = 404
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        $response.Close()
    }
    catch {
        Write-Host "Error processing request: $_"
    }
}
