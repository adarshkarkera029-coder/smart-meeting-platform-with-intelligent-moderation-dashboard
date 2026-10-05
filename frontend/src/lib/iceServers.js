/**
 * STUN + TURN so guests on other networks can join the same room.
 * Override with VITE_TURN_* after adding a Metered/Twilio TURN account.
 */
export function getIceServers() {
  const stun = {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
    ],
  };

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUser = import.meta.env.VITE_TURN_USERNAME;
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl && turnUser && turnCred) {
    return [
      stun,
      {
        urls: String(turnUrl)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        username: turnUser,
        credential: turnCred,
      },
    ];
  }

  return [
    stun,
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
        "turns:openrelay.metered.ca:443",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ];
}
