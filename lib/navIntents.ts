// One-shot navigation intents between screens that can't pass state directly
// (e.g. Profile → Community's internal My Posts view). Set before navigating;
// the destination consumes (and clears) it on focus.

let myPostsIntent = false;

export function requestMyPosts() {
  myPostsIntent = true;
}

export function consumeMyPostsIntent(): boolean {
  const v = myPostsIntent;
  myPostsIntent = false;
  return v;
}
