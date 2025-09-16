// 获取所有密码
async function loadPasswords() {
  try {
    const passwords = await window.passwordAPI.getPasswords();
    console.log('Loaded passwords:', passwords);
    return passwords;
  } catch (error) {
    console.error('Failed to load passwords:', error);
    return [];
  }
}

// 添加新密码
async function addNewPassword(passwordData) {
  try {
    const newId = await window.passwordAPI.addPassword(passwordData);
    console.log('Added new password with ID:', newId);
    return newId;
  } catch (error) {
    console.error('Failed to add password:', error);
    return null;
  }
}

// 更新密码
async function updatePassword(id, passwordData) {
  try {
    const changes = await window.passwordAPI.updatePassword(id, passwordData);
    console.log(`Updated password ${id}, changes: ${changes}`);
    return changes > 0;
  } catch (error) {
    console.error('Failed to update password:', error);
    return false;
  }
}

// 删除密码
async function deletePassword(id) {
  try {
    const changes = await window.passwordAPI.deletePassword(id);
    console.log(`Deleted password ${id}, changes: ${changes}`);
    return changes > 0;
  } catch (error) {
    console.error('Failed to delete password:', error);
    return false;
  }
}

// 搜索密码
async function searchPasswords(query) {
  try {
    const results = await window.passwordAPI.searchPasswords(query);
    console.log(`Search results for "${query}":`, results);
    return results;
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}

export { loadPasswords, addNewPassword, updatePassword, deletePassword, searchPasswords };
