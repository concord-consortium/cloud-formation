export function mapFromTagging(tagging) {
  let tags = {};
  if (tagging && tagging.TagSet) {
    tagging.TagSet.forEach(entry => {
      tags[entry.Key] = entry.Value;
    });
  }
  return tags;
}
