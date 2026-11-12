/**
 * Preload for a launcher process under test (`node --import <this file> cli.ts …`): redirects TCP
 * connections to `127.0.0.1:<from>` to `127.0.0.1:<to>`, given as `PORT_REDIRECT=<from>:<to>`.
 * Without `PORT_REDIRECT` it changes nothing.
 *
 * Lets a test check that the launcher asks the standard port 4310 (Baseline 11.3) while its test
 * server listens on a free port, so no test occupies 4310 (#329). The launcher still builds the
 * address with 4310: the request keeps `Host: 127.0.0.1:4310`, only the socket goes elsewhere.
 * Connections to any other address or port are unchanged.
 */
import net from 'node:net';

const redirect = process.env.PORT_REDIRECT;
if (redirect) redirectPort(...(redirect.split(':').map(Number) as [number, number]));

function redirectPort(from: number, to: number): void {
  const connect = net.connect as (...args: unknown[]) => net.Socket;
  net.connect = net.createConnection = function (...args: unknown[]) {
    const [options] = args;
    if (
      typeof options === 'object' &&
      options !== null &&
      'host' in options &&
      options.host === '127.0.0.1' &&
      'port' in options &&
      Number(options.port) === from
    ) {
      args[0] = { ...options, port: to };
    }
    return connect(...args);
  } as typeof net.connect;
}
