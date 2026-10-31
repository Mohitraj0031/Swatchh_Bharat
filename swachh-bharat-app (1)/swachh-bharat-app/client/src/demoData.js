const cities = [
  ['Mumbai', 'Maharashtra'], ['Pune', 'Maharashtra'], ['Nagpur', 'Maharashtra'],
  ['Delhi', 'Delhi'], ['Jaipur', 'Rajasthan'], ['Jodhpur', 'Rajasthan'],
  ['Lucknow', 'Uttar Pradesh'], ['Varanasi', 'Uttar Pradesh'], ['Agra', 'Uttar Pradesh'],
  ['Patna', 'Bihar'], ['Gaya', 'Bihar'], ['Bengaluru', 'Karnataka'],
  ['Mysuru', 'Karnataka'], ['Chennai', 'Tamil Nadu'], ['Coimbatore', 'Tamil Nadu'],
  ['Hyderabad', 'Telangana'], ['Kochi', 'Kerala'], ['Thiruvananthapuram', 'Kerala'],
  ['Kolkata', 'West Bengal'], ['Bhubaneswar', 'Odisha'], ['Guwahati', 'Assam'],
  ['Ranchi', 'Jharkhand'], ['Bhopal', 'Madhya Pradesh'], ['Indore', 'Madhya Pradesh'],
  ['Ahmedabad', 'Gujarat'], ['Surat', 'Gujarat'], ['Chandigarh', 'Chandigarh'],
  ['Dehradun', 'Uttarakhand'], ['Shimla', 'Himachal Pradesh'], ['Panaji', 'Goa'],
  ['Srinagar', 'Jammu and Kashmir'], ['Raipur', 'Chhattisgarh'], ['Amritsar', 'Punjab'],
  ['Vijayawada', 'Andhra Pradesh'], ['Gangtok', 'Sikkim'], ['Shillong', 'Meghalaya'],
  ['Aizawl', 'Mizoram'], ['Kohima', 'Nagaland'], ['Imphal', 'Manipur'],
  ['Itanagar', 'Arunachal Pradesh'], ['Agartala', 'Tripura'], ['Kottayam', 'Kerala'],
];

const issueCounts = [0, 1, 3, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1];

export const demoAreas = cities.map(([name, state], index) => {
  const openIssues = issueCounts[index];
  return {
    _id: `66400000000000000000${String(index + 1).padStart(4, '0')}`,
    name,
    state,
    openIssues,
    status: openIssues === 0 ? 'clean' : openIssues < 3 ? 'attention' : 'not_clean',
    updatedAt: new Date(),
  };
});

const reportDefinitions = [
  [0, 'Overflowing dustbin', 'The public bin near the main entrance is full.', 'Submitted'],
  [2, 'Garbage pile', 'Garbage has collected beside the main road.', 'In Progress'],
  [4, 'Open drain', 'The drain needs cleaning before the next rainfall.', 'Resolved'],
  [6, 'Littering', 'Plastic waste is scattered around the market area.', 'Submitted'],
  [10, 'Garbage pile', 'A large pile needs collection near the bus stop.', 'In Progress'],
];

export const demoReports = reportDefinitions.map(([areaIndex, issueType, description, status], index) => ({
  _id: `66500000000000000000${String(index + 1).padStart(4, '0')}`,
  area: { _id: demoAreas[areaIndex]._id, name: demoAreas[areaIndex].name },
  issueType,
  description,
  reporter: 'Demo citizen',
  status,
  createdAt: new Date(Date.now() - index * 86400000),
  updatedAt: new Date(),
}));
