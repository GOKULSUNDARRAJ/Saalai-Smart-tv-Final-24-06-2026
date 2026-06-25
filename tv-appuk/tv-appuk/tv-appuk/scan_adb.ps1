foreach ($i in 1..254) {
    $ip = "192.168.0.$i"
    $tcp = New-Object Net.Sockets.TcpClient
    $async = $tcp.BeginConnect($ip, 5555, $null, $null)
    if ($async.AsyncWaitHandle.WaitOne(50, $false)) {
        try {
            $tcp.EndConnect($async)
            Write-Output $ip
        } catch {}
    }
    $tcp.Close()
}
