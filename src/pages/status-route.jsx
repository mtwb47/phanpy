import { useParams } from 'react-router-dom';

import Status from './status';

export default function StatusRoute() {
  const params = useParams();
  const { id: rawId, instance } = params;
  // Decode the ID in case it was URL-encoded (e.g., Bluesky AT URIs with slashes)
  const id = rawId ? decodeURIComponent(rawId) : rawId;
  return <Status id={id} instance={instance} />;
}
