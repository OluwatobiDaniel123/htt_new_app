import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from './client.js';
import {
  getCoachingApprentice,
  listCoachingApprentices,
  updateCoachingApprenticeStatus,
} from './coachingApprentices.js';

test('recruitment list sends supported status and pagination query parameters', async (context) => {
  let captured;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    captured = { url: String(url), options };
    return new Response(JSON.stringify({
      success: true,
      data: { items: [], pagination: { page: 2, limit: 25, total: 26, totalPages: 2 } },
    }), { status: 200 });
  });

  const result = await listCoachingApprentices({ page: 2, limit: 25, status: 'under_review' });
  assert.deepEqual(result.pagination, { page: 2, limit: 25, total: 26, totalPages: 2 });
  assert.match(captured.url, /\/coaching-apprentices\?page=2&limit=25&status=under_review$/);
  assert.equal(captured.options.credentials, 'include');
});

test('recruitment detail uses the encoded application id', async (context) => {
  let capturedUrl;
  context.mock.method(globalThis, 'fetch', async (url) => {
    capturedUrl = String(url);
    return new Response(JSON.stringify({ success: true, data: { id: 'id/with-slash' } }), { status: 200 });
  });

  const result = await getCoachingApprentice('id/with-slash');
  assert.equal(result.id, 'id/with-slash');
  assert.match(capturedUrl, /\/coaching-apprentices\/id%2Fwith-slash$/);
});

test('recruitment status update sends the backend schema payload', async (context) => {
  let captured;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    captured = { url: String(url), options };
    return new Response(JSON.stringify({ success: true, data: { id: 'app-id', status: 'shortlisted' } }), { status: 200 });
  });

  const result = await updateCoachingApprenticeStatus('app-id', 'shortlisted');
  assert.equal(result.status, 'shortlisted');
  assert.match(captured.url, /\/coaching-apprentices\/app-id\/status$/);
  assert.equal(captured.options.method, 'PATCH');
  assert.deepEqual(JSON.parse(captured.options.body), { status: 'shortlisted' });
  assert.equal(captured.options.credentials, 'include');
});

test('recruitment API preserves the backend storage-unavailable error', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    success: false,
    error: {
      code: 'RECRUITMENT_STORAGE_UNAVAILABLE',
      message: 'Recruitment applications are temporarily unavailable.',
    },
  }), { status: 503 }));

  await assert.rejects(
    listCoachingApprentices(),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 503);
      assert.equal(error.code, 'RECRUITMENT_STORAGE_UNAVAILABLE');
      assert.equal(error.message, 'Recruitment applications are temporarily unavailable.');
      return true;
    },
  );
});
