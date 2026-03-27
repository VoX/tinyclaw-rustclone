import { query, hasComponent } from 'bitecs';
import { Player, Position, Dead } from '../../shared/components.js';
import { MSG } from '../../shared/protocol.js';

const MAX_TEAM_SIZE = 4;

export function createTeamSystem(gameState) {
  // teamId -> Set<playerEid>
  if (!gameState.teams) gameState.teams = new Map();
  // playerEid -> teamId
  if (!gameState.playerTeam) gameState.playerTeam = new Map();
  // pendingInvites: targetEid -> { fromEid, teamId, expires }
  if (!gameState.teamInvites) gameState.teamInvites = new Map();

  let nextTeamId = 1;

  function getTeamMembers(teamId) {
    return gameState.teams.get(teamId) || new Set();
  }

  function sendTeamUpdate(eid) {
    const connId = Player.connectionId[eid];
    const client = gameState.clients.get(connId);
    if (!client || !client.ws) return;

    const teamId = gameState.playerTeam.get(eid);
    if (!teamId) {
      try { client.ws.send(JSON.stringify({ type: MSG.TEAM_UPDATE, members: [] })); } catch (e) {}
      return;
    }

    const members = getTeamMembers(teamId);
    const list = [];
    for (const m of members) {
      const name = gameState.playerNames.get(m) || `Player ${m}`;
      list.push({ eid: m, name });
    }
    try { client.ws.send(JSON.stringify({ type: MSG.TEAM_UPDATE, members: list })); } catch (e) {}
  }

  function sendChatToPlayer(eid, text) {
    const connId = Player.connectionId[eid];
    const client = gameState.clients.get(connId);
    if (!client || !client.ws) return;
    try {
      client.ws.send(JSON.stringify({
        type: MSG.CHAT,
        senderEid: 0,
        senderName: '[Team]',
        text,
      }));
    } catch (e) {}
  }

  return function TeamSystem(world) {
    // Process /team commands from chat messages
    for (const [connId, client] of gameState.clients) {
      if (!client.chatMessage) continue;
      const text = client.chatMessage;
      if (!text.startsWith('/team ')) continue;

      // Consume the chat message (don't broadcast it)
      client.chatMessage = null;

      const eid = client.playerEid;
      if (!eid || hasComponent(world, eid, Dead)) continue;

      const parts = text.trim().split(/\s+/);
      const subCmd = parts[1];

      if (subCmd === 'invite') {
        const targetName = parts.slice(2).join(' ');
        if (!targetName) {
          sendChatToPlayer(eid, 'Usage: /team invite [player name]');
          continue;
        }

        // Find player by name
        let targetEid = null;
        for (const [peid, name] of gameState.playerNames) {
          if (name.toLowerCase() === targetName.toLowerCase()) {
            targetEid = peid;
            break;
          }
        }
        if (!targetEid) {
          sendChatToPlayer(eid, `Player "${targetName}" not found`);
          continue;
        }
        if (targetEid === eid) {
          sendChatToPlayer(eid, "You can't invite yourself");
          continue;
        }

        // Check if already on same team
        const myTeam = gameState.playerTeam.get(eid);
        const theirTeam = gameState.playerTeam.get(targetEid);
        if (myTeam && theirTeam && myTeam === theirTeam) {
          sendChatToPlayer(eid, 'Already on the same team');
          continue;
        }

        // Check team size
        let teamId = myTeam;
        if (teamId) {
          const members = getTeamMembers(teamId);
          if (members.size >= MAX_TEAM_SIZE) {
            sendChatToPlayer(eid, `Team is full (max ${MAX_TEAM_SIZE})`);
            continue;
          }
        }

        // Create pending invite
        if (!teamId) {
          teamId = nextTeamId++;
          gameState.teams.set(teamId, new Set([eid]));
          gameState.playerTeam.set(eid, teamId);
        }

        gameState.teamInvites.set(targetEid, {
          fromEid: eid,
          teamId,
          expires: gameState.tick + 20 * 30, // 30 seconds
        });

        const inviterName = gameState.playerNames.get(eid) || 'Someone';
        sendChatToPlayer(eid, `Invite sent to ${targetName}`);
        sendChatToPlayer(targetEid, `${inviterName} invited you to their team. Type /team accept`);

      } else if (subCmd === 'accept') {
        const invite = gameState.teamInvites.get(eid);
        if (!invite || invite.expires < gameState.tick) {
          sendChatToPlayer(eid, 'No pending team invite');
          gameState.teamInvites.delete(eid);
          continue;
        }

        const teamId = invite.teamId;
        const members = getTeamMembers(teamId);
        if (members.size >= MAX_TEAM_SIZE) {
          sendChatToPlayer(eid, 'Team is full');
          gameState.teamInvites.delete(eid);
          continue;
        }

        // Leave current team if any
        const oldTeam = gameState.playerTeam.get(eid);
        if (oldTeam) {
          const oldMembers = getTeamMembers(oldTeam);
          oldMembers.delete(eid);
          if (oldMembers.size === 0) gameState.teams.delete(oldTeam);
          else {
            for (const m of oldMembers) sendTeamUpdate(m);
          }
        }

        // Join new team
        members.add(eid);
        gameState.playerTeam.set(eid, teamId);
        gameState.teamInvites.delete(eid);

        const myName = gameState.playerNames.get(eid) || 'Someone';
        for (const m of members) {
          sendChatToPlayer(m, `${myName} joined the team`);
          sendTeamUpdate(m);
        }

        // Share TC auth: add new member to all TCs the team has access to
        for (const [tcEid, authSet] of gameState.tcAuth) {
          for (const m of members) {
            if (m !== eid && authSet.has(m)) {
              authSet.add(eid);
              break;
            }
          }
        }

      } else if (subCmd === 'leave') {
        const teamId = gameState.playerTeam.get(eid);
        if (!teamId) {
          sendChatToPlayer(eid, 'Not on a team');
          continue;
        }

        const members = getTeamMembers(teamId);
        members.delete(eid);
        gameState.playerTeam.delete(eid);
        sendTeamUpdate(eid);

        const myName = gameState.playerNames.get(eid) || 'Someone';
        if (members.size === 0) {
          gameState.teams.delete(teamId);
        } else {
          for (const m of members) {
            sendChatToPlayer(m, `${myName} left the team`);
            sendTeamUpdate(m);
          }
        }

      } else if (subCmd === 'list') {
        const teamId = gameState.playerTeam.get(eid);
        if (!teamId) {
          sendChatToPlayer(eid, 'Not on a team');
          continue;
        }
        const members = getTeamMembers(teamId);
        const names = [...members].map(m => gameState.playerNames.get(m) || `Player ${m}`);
        sendChatToPlayer(eid, `Team (${names.length}/${MAX_TEAM_SIZE}): ${names.join(', ')}`);

      } else {
        sendChatToPlayer(eid, 'Usage: /team invite|accept|leave|list');
      }
    }

    // Clean up expired invites
    for (const [eid, invite] of gameState.teamInvites) {
      if (invite.expires < gameState.tick) {
        gameState.teamInvites.delete(eid);
      }
    }

    // Clean up disconnected players from teams
    for (const [teamId, members] of gameState.teams) {
      for (const m of members) {
        if (!hasComponent(world, m, Player)) {
          members.delete(m);
          gameState.playerTeam.delete(m);
        }
      }
      if (members.size === 0) {
        gameState.teams.delete(teamId);
      }
    }

    return world;
  };
}

// Helper: check if two players are on the same team
export function areTeammates(gameState, eid1, eid2) {
  if (!gameState.playerTeam) return false;
  const t1 = gameState.playerTeam.get(eid1);
  const t2 = gameState.playerTeam.get(eid2);
  return t1 && t2 && t1 === t2;
}
