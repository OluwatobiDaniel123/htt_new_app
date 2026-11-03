import { api } from './client.js';

const endpoint = '/coaching-apprentices';

/** @param {{ page?: number, limit?: number, status?: string }} [options] */
export const listCoachingApprentices = ({ page = 1, limit = 25, status } = {}) =>
  api.get(endpoint, { page, limit, ...(status ? { status } : {}) });

export const getCoachingApprentice = (id) =>
  api.get(`${endpoint}/${encodeURIComponent(id)}`);

export const updateCoachingApprenticeStatus = (id, status) =>
  api.patch(`${endpoint}/${encodeURIComponent(id)}/status`, { status });

