import { describe, expect, it } from 'vitest';

import * as media from './index.ts';

describe('public interface of media (Technical Specification 4.1, exception (1))', () => {
  it('exports only its route registration and the file intake CU-090, not the media store CU-088 (FIND-370)', () => {
    expect(Object.keys(media).sort()).toEqual(['createMediaFileIntake', 'mediaRoutes']);
  });
});
