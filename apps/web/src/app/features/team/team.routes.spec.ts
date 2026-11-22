import { TEAM_ROUTES } from './team.routes';

describe('TEAM_ROUTES', () => {
  it('registers the static invitations route before the member identifier', () => {
    expect(TEAM_ROUTES.map(({ path }) => path)).toEqual(['', 'invitaciones', ':id']);
  });
});
