export function isOwner(userId:string|null|undefined,email:string|null|undefined,owner:string|null|undefined){
  return Boolean(userId && email && owner && email.toLowerCase()===owner.toLowerCase());
}
