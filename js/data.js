const USERS = [
  {
    id: 1,
    name: "Bogdan Radzevich",
    email: "br624@drexel.edu",
    major: "Computer Science",
    graduationYear: 2028,
    university: "Drexel University",
    bio: "Looking for housing and co-op advice.",
    verified: true,
  },
  {
    id: 2,
    name: "Same Lee",
    email: "sl5678@drexel.edu",
    major: "Computer Science",
    graduationYear: 2026,
    university: "Drexel University",
    bio: "Junior interested in software co-ops.",
    verified: false,
  },
  {
    id: 3,
    name: "Alex Park",
    email: "ap9012@drexel.edu",
    major: "Software Engineering",
    graduationYear: 2027,
    university: "Drexel University",
    bio: "Also searching for a roommate near campus.",
    verified: true,
  },
  {
    id: 4,
    name: "Shone Mathew",
    email: "sm4782@drexel.edu",
    major: "Computer Science",
    graduationYear: 2027,
    university: "Drexel University",
    bio: "",
    verified: false,
  },
];

const THREADS = [
  {
    id: 1,
    category: "Housing",
    title: "Looking for roommate near University City",
    authorId: 1,
    createdAt: "2026-01-12",
    body: "Budget around $900/mo. Prefer quiet, junior CS student. Move-in for spring term if possible.",
    preview: "Budget around $900/mo. Prefer quiet, junior CS student...",
  },
  {
    id: 2,
    category: "Co-ops",
    title: "Anyone done a CS co-op at Comcast?",
    authorId: 2,
    createdAt: "2026-01-08",
    body: "Applying for summer co-op. Curious about the interview process and day-to-day work.",
    preview: "Applying for summer co-op. Curious about the interview process...",
  },
  {
    id: 3,
    category: "Campus",
    title: "Best study spots on campus during midterms?",
    authorId: 4,
    createdAt: "2026-01-10",
    body: "Library gets packed. Looking for quieter alternatives that are still open late.",
    preview: "Library gets packed. Looking for quieter alternatives...",
  },
  {
    id: 4,
    category: "Housing",
    title: "Subletting a room near 33rd for spring",
    authorId: 3,
    createdAt: "2026-01-05",
    body: "One bedroom available in a 3BR. Utilities included. Message if interested.",
    preview: "One bedroom available in a 3BR. Utilities included...",
  },
  {
    id: 5,
    category: "Co-ops",
    title: "Finance co-op tips for non-majors?",
    authorId: 1,
    createdAt: "2026-01-03",
    body: "CS major thinking about a finance co-op. Has anyone made that switch?",
    preview: "CS major thinking about a finance co-op. Has anyone made that switch?",
  },
];

const COMMENTS = [
  {
    id: 1,
    threadId: 1,
    authorId: 3,
    body: "I'm looking too — reach out if you still have a spot open.",
    createdAt: "2026-01-12",
  },
  {
    id: 2,
    threadId: 1,
    authorId: 4,
    body: "Check the UC Discord housing channel; people post there often.",
    createdAt: "2026-01-13",
  },
  {
    id: 3,
    threadId: 2,
    authorId: 1,
    body: "I interviewed there last year. Expect coding + behavioral rounds.",
    createdAt: "2026-01-09",
  },
  {
    id: 4,
    threadId: 2,
    authorId: 3,
    body: "Team depends a lot on which org you land in. Ask about that in the interview.",
    createdAt: "2026-01-10",
  },
  {
    id: 5,
    threadId: 3,
    authorId: 1,
    body: "Lebow atrium is underrated in the evenings.",
    createdAt: "2026-01-11",
  },
  {
    id: 6,
    threadId: 4,
    authorId: 2,
    body: "Is parking included? Also interested.",
    createdAt: "2026-01-06",
  },
];

function getUserById(id) {
  return USERS.find(function (user) {
    return user.id === id;
  });
}

function getThreadById(id) {
  return THREADS.find(function (thread) {
    return thread.id === id;
  });
}

function getCommentsForThread(threadId) {
  return COMMENTS.filter(function (comment) {
    return comment.threadId === threadId;
  });
}

function formatVerified(user) {
  if (!user) {
    return "";
  }
  return user.verified ? "(verified)" : "(unverified)";
}

function getUserActivity(userId) {
  var activity = [];

  THREADS.forEach(function (thread) {
    if (thread.authorId === userId) {
      activity.push({
        type: "post",
        text: "Posted in " + thread.category + " — " + thread.title,
        date: thread.createdAt,
        threadId: thread.id,
      });
    }
  });

  COMMENTS.forEach(function (comment) {
    if (comment.authorId === userId) {
      var thread = getThreadById(comment.threadId);
      var title = thread ? thread.title : "a thread";
      activity.push({
        type: "comment",
        text: "Commented on " + title,
        date: comment.createdAt,
        threadId: comment.threadId,
      });
    }
  });

  activity.sort(function (a, b) {
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });

  return activity;
}
