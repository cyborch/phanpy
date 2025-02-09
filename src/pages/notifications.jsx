import './notifications.css';

import { memo } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import Avatar from '../components/avatar';
import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import NameText from '../components/name-text';
import RelativeTime from '../components/relative-time';
import Status from '../components/status';
import states, { saveStatus } from '../utils/states';
import store from '../utils/store';
import useTitle from '../utils/useTitle';

/*
Notification types
==================
mention = Someone mentioned you in their status
status = Someone you enabled notifications for has posted a status
reblog = Someone boosted one of your statuses
follow = Someone followed you
follow_request = Someone requested to follow you
favourite = Someone favourited one of your statuses
poll = A poll you have voted in or created has ended
update = A status you interacted with has been edited
admin.sign_up = Someone signed up (optionally sent to admins)
admin.report = A new report has been filed
*/

const contentText = {
  mention: 'mentioned you in their status.',
  status: 'posted a status.',
  reblog: 'boosted your status.',
  follow: 'followed you.',
  follow_request: 'requested to follow you.',
  favourite: 'favourited your status.',
  poll: 'A poll you have voted in or created has ended.',
  'poll-self': 'A poll you have created has ended.',
  'poll-voted': 'A poll you have voted in has ended.',
  update: 'A status you interacted with has been edited.',
};

const LIMIT = 30; // 30 is the maximum limit :(

function Notification({ notification }) {
  const { id, type, status, account, _accounts } = notification;

  // status = Attached when type of the notification is favourite, reblog, status, mention, poll, or update
  const actualStatusID = status?.reblog?.id || status?.id;

  const currentAccount = store.session.get('currentAccount');
  const isSelf = currentAccount === account?.id;
  const isVoted = status?.poll?.voted;

  const text =
    type === 'poll'
      ? contentText[isSelf ? 'poll-self' : isVoted ? 'poll-voted' : 'poll']
      : contentText[type];

  return (
    <>
      <div
        class={`notification-type notification-${type}`}
        title={new Date(notification.createdAt).toLocaleString()}
      >
        <Icon
          icon={
            {
              mention: 'comment',
              status: 'notification',
              reblog: 'rocket',
              follow: 'follow',
              follow_request: 'follow-add',
              favourite: 'heart',
              poll: 'poll',
              update: 'pencil',
            }[type] || 'notification'
          }
          size="xl"
          alt={type}
        />
      </div>
      <div class="notification-content">
        {type !== 'mention' && (
          <>
            <p>
              {!/poll|update/i.test(type) && (
                <>
                  {_accounts?.length > 1 ? (
                    <>
                      <b>{_accounts.length} people</b>{' '}
                    </>
                  ) : (
                    <>
                      <NameText account={account} showAvatar />{' '}
                    </>
                  )}
                </>
              )}
              {text}
              {type === 'mention' && (
                <span class="insignificant">
                  {' '}
                  •{' '}
                  <RelativeTime
                    datetime={notification.createdAt}
                    format="micro"
                  />
                </span>
              )}
            </p>
            {type === 'follow_request' && (
              <FollowRequestButtons
                accountID={account.id}
                onChange={() => {
                  loadNotifications(true);
                }}
              />
            )}
          </>
        )}
        {_accounts?.length > 1 && (
          <p class="avatars-stack">
            {_accounts.map((account, i) => (
              <>
                <a
                  href={account.url}
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    states.showAccount = account;
                  }}
                >
                  <Avatar
                    url={account.avatarStatic}
                    size={
                      _accounts.length < 30
                        ? 'xl'
                        : _accounts.length < 100
                        ? 'l'
                        : _accounts.length < 1000
                        ? 'm'
                        : 's' // My god, this person is popular!
                    }
                    key={account.id}
                    alt={`${account.displayName} @${account.acct}`}
                  />
                </a>{' '}
              </>
            ))}
          </p>
        )}
        {status && (
          <Link
            class={`status-link status-type-${type}`}
            to={`/s/${actualStatusID}`}
          >
            <Status status={status} size="s" />
          </Link>
        )}
      </div>
    </>
  );
}

function NotificationsList({ notifications, emptyCopy }) {
  if (!notifications.length && emptyCopy) {
    return <p class="timeline-empty">{emptyCopy}</p>;
  }

  // Create new flat list of notifications
  // Combine sibling notifications based on type and status id, ignore the id
  // Concat all notification.account into an array of _accounts
  const notificationsMap = {};
  const cleanNotifications = [];
  for (let i = 0, j = 0; i < notifications.length; i++) {
    const notification = notifications[i];
    // const cleanNotification = cleanNotifications[j];
    const { status, account, type, created_at } = notification;
    const createdAt = new Date(created_at).toLocaleDateString();
    const key = `${status?.id}-${type}-${createdAt}`;
    const mappedNotification = notificationsMap[key];
    if (mappedNotification?.account) {
      mappedNotification._accounts.push(account);
    } else {
      let n = (notificationsMap[key] = {
        ...notification,
        _accounts: [account],
      });
      cleanNotifications[j++] = n;
    }
  }
  // console.log({ notifications, cleanNotifications });

  return (
    <ul class="timeline flat">
      {cleanNotifications.map((notification, i) => {
        const { id, type } = notification;
        return (
          <li key={id} class={`notification ${type}`} tabIndex="0">
            <Notification notification={notification} />
          </li>
        );
      })}
    </ul>
  );
}

function Notifications() {
  useTitle('Notifications');
  const snapStates = useSnapshot(states);
  const [uiState, setUIState] = useState('default');
  const [showMore, setShowMore] = useState(false);
  const [onlyMentions, setOnlyMentions] = useState(false);

  console.debug('RENDER Notifications');

  const notificationsIterator = useRef(
    masto.v1.notifications.list({
      limit: LIMIT,
    }),
  );
  async function fetchNotifications(firstLoad) {
    if (firstLoad) {
      // Reset iterator
      notificationsIterator.current = masto.v1.notifications.list({
        limit: LIMIT,
      });
      states.notificationsNew = [];
    }
    const allNotifications = await notificationsIterator.current.next();
    if (allNotifications.value?.length) {
      const notificationsValues = allNotifications.value.map((notification) => {
        saveStatus(notification.status, {
          skipThreading: true,
          override: false,
        });
        return notification;
      });
      if (firstLoad) {
        states.notifications = notificationsValues;
      } else {
        states.notifications.push(...notificationsValues);
      }
    }
    states.notificationsLastFetchTime = Date.now();
    return allNotifications;
  }

  const loadNotifications = (firstLoad) => {
    setUIState('loading');
    (async () => {
      try {
        const { done } = await fetchNotifications(firstLoad);
        setShowMore(!done);
        setUIState('default');
      } catch (e) {
        setUIState('error');
      }
    })();
  };

  useEffect(() => {
    loadNotifications(true);
  }, []);

  const scrollableRef = useRef();

  // Group notifications by today, yesterday, and older
  const groupedNotifications = snapStates.notifications.reduce(
    (acc, notification) => {
      const date = new Date(notification.createdAt);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      if (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      ) {
        acc.today.push(notification);
      } else if (
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear()
      ) {
        acc.yesterday.push(notification);
      } else {
        acc.older.push(notification);
      }
      return acc;
    },
    { today: [], yesterday: [], older: [] },
  );
  // console.log(groupedNotifications);
  return (
    <div
      id="notifications-page"
      class="deck-container"
      ref={scrollableRef}
      tabIndex="-1"
    >
      <div class={`timeline-deck deck ${onlyMentions ? 'only-mentions' : ''}`}>
        <header
          onClick={() => {
            scrollableRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <div class="header-side">
            <Link to="/" class="button plain">
              <Icon icon="home" size="l" />
            </Link>
          </div>
          <h1>Notifications</h1>
          <div class="header-side">
            <Loader hidden={uiState !== 'loading'} />
          </div>
        </header>
        {snapStates.notificationsNew.length > 0 && (
          <button
            class="updates-button"
            type="button"
            onClick={() => {
              const uniqueNotificationsNew = snapStates.notificationsNew.filter(
                (notification) =>
                  !snapStates.notifications.some(
                    (n) => n.id === notification.id,
                  ),
              );
              states.notifications.unshift(...uniqueNotificationsNew);
              loadNotifications(true);
              states.notificationsNew = [];

              scrollableRef.current?.scrollTo({
                top: 0,
                behavior: 'smooth',
              });
            }}
          >
            <Icon icon="arrow-up" /> New notifications
          </button>
        )}
        <div id="mentions-option">
          <label>
            <input
              type="checkbox"
              checked={onlyMentions}
              onChange={(e) => {
                setOnlyMentions(e.target.checked);
              }}
            />{' '}
            Only mentions
          </label>
        </div>
        {snapStates.notifications.length ? (
          <>
            <h2 class="timeline-header">Today</h2>
            <NotificationsList
              notifications={groupedNotifications.today}
              emptyCopy="You're all caught up."
            />
            {groupedNotifications.yesterday.length > 0 && (
              <>
                <h2 class="timeline-header">Yesterday</h2>
                <NotificationsList
                  notifications={groupedNotifications.yesterday}
                />
              </>
            )}
            {groupedNotifications.older.length > 0 && (
              <>
                <h2 class="timeline-header">Older</h2>
                <NotificationsList notifications={groupedNotifications.older} />
              </>
            )}
            {showMore && (
              <button
                type="button"
                class="plain block"
                disabled={uiState === 'loading'}
                onClick={() => loadNotifications()}
                style={{ marginBlockEnd: '6em' }}
              >
                {uiState === 'loading' ? <Loader /> : <>Show more&hellip;</>}
              </button>
            )}
          </>
        ) : (
          <>
            {uiState === 'loading' && (
              <>
                <h2 class="timeline-header">Today</h2>
                <ul class="timeline flat">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <li class="notification skeleton">
                      <div class="notification-type">
                        <Icon icon="notification" size="xl" />
                      </div>
                      <div class="notification-content">
                        <p>███████████ ████</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {uiState === 'error' && (
              <p class="ui-state">
                Unable to load notifications
                <br />
                <br />
                <button type="button" onClick={() => loadNotifications(true)}>
                  Try again
                </button>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FollowRequestButtons({ accountID, onChange }) {
  const [uiState, setUIState] = useState('default');
  return (
    <p>
      <button
        type="button"
        disabled={uiState === 'loading'}
        onClick={() => {
          setUIState('loading');
          (async () => {
            try {
              await masto.v1.followRequests.authorize(accountID);
              onChange();
            } catch (e) {
              console.error(e);
              setUIState('default');
            }
          })();
        }}
      >
        Accept
      </button>{' '}
      <button
        type="button"
        disabled={uiState === 'loading'}
        class="light danger"
        onClick={() => {
          setUIState('loading');
          (async () => {
            try {
              await masto.v1.followRequests.reject(accountID);
              onChange();
            } catch (e) {
              console.error(e);
              setUIState('default');
            }
          })();
        }}
      >
        Reject
      </button>
      <Loader hidden={uiState !== 'loading'} />
    </p>
  );
}

export default memo(Notifications);
