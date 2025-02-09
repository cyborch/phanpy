import { useLocation } from 'react-router-dom';

import states from '../utils/states';

/* NOTES
   =====
   Initially this uses <NavLink> from react-router-dom, but it doesn't work:
   1. It interferes with nested <a> inside <a> and it's difficult to preventDefault/stopPropagation from the nested <a>
   2. isActive doesn't work properly with the weird routes that's set up in this app, due to the faux "location" to make the modals work and prevent unmounting
   3. Not using <Link state/> because it modifies history.state that *persists* across page reloads. I don't need that, so using valtio's states instead.
*/

const Link = (props) => {
  let routerLocation;
  try {
    routerLocation = useLocation();
  } catch (e) {}
  let hash = (location.hash || '').replace(/^#/, '').trim();
  if (hash === '') hash = '/';
  const isActive = hash === props.to;
  return (
    <a
      href={`#${props.to}`}
      {...props}
      class={`${props.class || ''} ${isActive ? 'is-active' : ''}`}
      onClick={(e) => {
        if (routerLocation) states.prevLocation = routerLocation;
        props.onClick?.(e);
      }}
    />
  );
};

export default Link;
