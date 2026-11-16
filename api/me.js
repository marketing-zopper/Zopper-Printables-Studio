import { route, send } from './_lib/http.js'
import { authenticate } from './_lib/auth.js'
import { permissionsFor } from './_lib/access.js'

// Who am I, and what may I do? The browser uses this to decide what to show;
// the other endpoints re-check on every call regardless.
export default route(['GET'], async (req, res) => {
  const auth = await authenticate(req)
  send(res, 200, {
    id: auth.user.id,
    email: auth.email,
    name: auth.name,
    role: auth.role,
    permissions: permissionsFor(auth.role),
  })
})
