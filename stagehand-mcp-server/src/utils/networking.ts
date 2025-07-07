import net from 'net'

export async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port }, () => {
      // Connection succeeded — port is already in use
      socket.end()
      resolve(true)
    })

    socket.on('error', (err: NodeJS.ErrnoException) => {
      // Connection failed — check if it's because nothing is listening
      if (err.code === 'ECONNREFUSED') {
        resolve(false) // Port is available
      } else {
        resolve(true) // Port is in use
      }
    })
  })
}

