import { isAdmin, getDeviceId } from '../../_utils.js';
import { validateDeviceId } from '../../_sanitize.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const topicId = params.id; // Use string ID (UUID)
  
  if (request.method === 'POST') {
    return handleVote(request, env, topicId);
  }
  
  if (request.method === 'GET') {
    return getVotes(env, topicId);
  }
  
  return new Response('Method not allowed', { status: 405 });
}

async function handleVote(request, env, topicId) {
  try {
    const body = await request.json();
    const { vote } = body; // 'up' or 'down'
    
    if (!vote || !['up', 'down'].includes(vote)) {
      return new Response(JSON.stringify({ error: 'Invalid vote type' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const deviceId = getDeviceId(request);
    
    // Validate device ID
    try {
      validateDeviceId(deviceId);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid device identifier' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const voteKey = `vote:topic:${topicId}:${deviceId}`;
    const upvotesKey = `votes:topic:${topicId}:up`;
    const downvotesKey = `votes:topic:${topicId}:down`;
    
    // Check if user already voted
    const existingVote = await env.RATE_LIMIT.get(voteKey);
    
    if (existingVote) {
      // Remove old vote
      if (existingVote === 'up') {
        const current = parseInt(await env.RATE_LIMIT.get(upvotesKey) || '0');
        await env.RATE_LIMIT.put(upvotesKey, Math.max(0, current - 1).toString());
      } else {
        const current = parseInt(await env.RATE_LIMIT.get(downvotesKey) || '0');
        await env.RATE_LIMIT.put(downvotesKey, Math.max(0, current - 1).toString());
      }
      
      // If same vote, remove it (toggle off)
      if (existingVote === vote) {
        await env.RATE_LIMIT.delete(voteKey);
        const upvotes = parseInt(await env.RATE_LIMIT.get(upvotesKey) || '0');
        const downvotes = parseInt(await env.RATE_LIMIT.get(downvotesKey) || '0');
        
        return new Response(JSON.stringify({
          upvotes,
          downvotes,
          userVote: null
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
    }
    
    // Add new vote
    await env.RATE_LIMIT.put(voteKey, vote, { expirationTtl: 60 * 60 * 24 * 365 }); // 1 year
    
    if (vote === 'up') {
      const current = parseInt(await env.RATE_LIMIT.get(upvotesKey) || '0');
      await env.RATE_LIMIT.put(upvotesKey, (current + 1).toString());
    } else {
      const current = parseInt(await env.RATE_LIMIT.get(downvotesKey) || '0');
      await env.RATE_LIMIT.put(downvotesKey, (current + 1).toString());
    }
    
    const upvotes = parseInt(await env.RATE_LIMIT.get(upvotesKey) || '0');
    const downvotes = parseInt(await env.RATE_LIMIT.get(downvotesKey) || '0');
    
    return new Response(JSON.stringify({
      upvotes,
      downvotes,
      userVote: vote
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
    
  } catch (err) {
    console.error('Vote error:', err);
    return new Response(JSON.stringify({ error: 'Failed to process vote' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}

async function getVotes(env, topicId) {
  try {
    const upvotesKey = `votes:topic:${topicId}:up`;
    const downvotesKey = `votes:topic:${topicId}:down`;
    
    const upvotes = parseInt(await env.RATE_LIMIT.get(upvotesKey) || '0');
    const downvotes = parseInt(await env.RATE_LIMIT.get(downvotesKey) || '0');
    
    return new Response(JSON.stringify({
      upvotes,
      downvotes
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    console.error('Get votes error:', err);
    return new Response(JSON.stringify({ error: 'Failed to get votes' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
