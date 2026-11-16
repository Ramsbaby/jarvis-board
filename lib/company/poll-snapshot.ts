/** Keep immutable API snapshots stable until any actual field changes. */
export function retainSnapshot<T>(previous:T,next:T):T{
 return JSON.stringify(previous)===JSON.stringify(next)?previous:next;
}
