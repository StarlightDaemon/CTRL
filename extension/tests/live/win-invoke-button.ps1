<#
.SYNOPSIS
  Invokes a native button (for example Chrome's "Allow" in the extension
  permission bubble) through Windows UI Automation.

.DESCRIPTION
  Browser automation protocols cannot reach native prompt UI. For the live
  verification harness this script performs the one click a human would:
  it looks for a button with the given name in the windows of the given
  process (and its children) and invokes it. Nothing else on the desktop is
  touched; if the button is not found within the timeout the script exits 1.

.PARAMETER ProcessId   Root process id of the browser instance started by the harness.
.PARAMETER ButtonName  Accessible name of the button, e.g. "Allow".
.PARAMETER TimeoutSeconds  How long to keep looking.
#>
param(
    [Parameter(Mandatory = $true)][int]$ProcessId,
    [Parameter(Mandatory = $true)][string]$ButtonName,
    [int]$TimeoutSeconds = 10
)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)

# All process ids in the browser's process tree (Chrome's prompt lives in the browser process,
# but be tolerant of helper processes).
function Get-ProcessTree([int]$pid0) {
    $ids = @($pid0)
    $queue = @($pid0)
    while ($queue.Count -gt 0) {
        $current = $queue[0]; $queue = $queue[1..$queue.Count]
        $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$current" | Select-Object -ExpandProperty ProcessId
        foreach ($c in $children) { if ($ids -notcontains $c) { $ids += $c; $queue += $c } }
    }
    return $ids
}

$tree = Get-ProcessTree $ProcessId
$buttonType = [System.Windows.Automation.ControlType]::Button
$seen = @()

while ((Get-Date) -lt $deadline) {
    $windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($w in $windows) {
        $procId = 0
        try { $procId = $w.Current.ProcessId } catch { continue }
        if ($tree -notcontains $procId) { continue }
        $seen += ($w.Current.Name + '#' + $procId)
        $cond = New-Object System.Windows.Automation.AndCondition(
            (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, $buttonType)),
            (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $ButtonName))
        )
        $button = $w.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
        if ($button -ne $null) {
            $pattern = $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
            $pattern.Invoke()
            Write-Output ("invoked '" + $ButtonName + "' in window '" + $w.Current.Name + "' (pid " + $procId + ")")
            exit 0
        }
    }
    Start-Sleep -Milliseconds 250
}
Write-Error ("button '" + $ButtonName + "' not found in process tree of " + $ProcessId + " within " + $TimeoutSeconds + " s; windows seen: " + (($seen | Select-Object -Unique) -join ' | '))
exit 1
