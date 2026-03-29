Get-ChildItem "components" -Recurse -Include "*.tsx" | ForEach-Object {
  $path = $_.FullName
  $original = Get-Content $path -Raw
  $updated = $original -replace '\[var\((--[a-zA-Z0-9_-]+)\)\]', '($1)'
  if ($original -ne $updated) {
    Set-Content $path $updated -NoNewline
    Write-Host "Updated: $($_.Name)"
  }
}
Write-Host "Done."
