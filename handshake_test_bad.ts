async function tlsAlpn(
  useStartTls: boolean,
): Promise<[Deno.TlsConn, Deno.TlsConn]> 
{
  const port = 33333;
  let x=0;
  console.log("test.ts: tlsAlpn: step", x++);
  const listener = Deno.listenTls({
    hostname: "localhost",
    port,
    certFile: "cli/tests/testdata/tls/localhost.crt",
    keyFile: "cli/tests/testdata/tls/localhost.key",
    alpnProtocols: ["deno", "rocks"],
  });

  console.log("test.ts: tlsAlpn: step", x++);
  const acceptPromise = listener.accept();
  console.log("test.ts: tlsAlpn: step", x++);

  const caCerts = [Deno.readTextFileSync("cli/tests/testdata/tls/RootCA.pem")];
  console.log("test.ts: tlsAlpn: step", x++);
  const clientAlpnProtocols = ["rocks", "rises"];
  let endpoints: [Deno.TlsConn, Deno.TlsConn];

  //if (!useStartTls) 
  {
    console.log("test.ts: tlsAlpn: step", x++);

    const connectPromise = Deno.connectTls({
      hostname: "localhost",
      port,
      caCerts,
      alpnProtocols: clientAlpnProtocols,
    });

    console.log("test.ts: tlsAlpn: step", x++);

    let a = await acceptPromise;
    console.log("test.ts: tlsAlpn: step", x++);
    
    let c = await connectPromise; // DEADLOCK!
    console.log("test.ts: tlsAlpn: step", x++);

    endpoints = await Promise.all([acceptPromise, connectPromise]);

    // c.handshake();
    // console.log("test.ts: tlsAlpn: step", x++);

    //endpoints = [a, c];
  } 

  listener.close();
  console.log("test.ts: tlsAlpn: step!!!!!!!!!!", x++);
  return endpoints;
}



async function tlsServerAlpnListenConnect() 
{
  let x=0;
  console.log("test.ts: tlsServerAlpnListenConnect: step", x++);
  const [serverConn, clientConn] = await tlsAlpn(false);
  console.log("test.ts: tlsServerAlpnListenConnect: step", x++);
  const [serverHS, clientHS] = await Promise.all(
    [
    serverConn.handshake(),
    clientConn.handshake(),
    ]
  );
  console.log("test.ts: tlsServerAlpnListenConnect: step", x++, serverHS.alpnProtocol);
  console.log("test.ts: tlsServerAlpnListenConnect: step", x++, clientHS.alpnProtocol);

  serverConn.close();
  console.log("test.ts: tlsServerAlpnListenConnect: step", x++);
  clientConn.close();
  console.log("test.ts: tlsServerAlpnListenConnect: step", x++);
}




tlsServerAlpnListenConnect();