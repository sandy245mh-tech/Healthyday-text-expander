const supabase = require('../config/db');
const { success, error } = require('../utils/response');

exports.getNotifications = async (req, res, next) => {
  try {
    const { data: notifications, error: dbErr } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (dbErr) throw dbErr;

    // Formatting output. For simplification without auth, we skip 'read' status per user
    // or just mark them unread.
    const formatted = notifications.map(notif => {
      // Check if this user's name is in the readBy array (assuming we add a readBy column)
      const isRead = notif.readBy && notif.readBy.includes(req.user.name);
      return {
        id: notif.id,
        type: notif.type,
        message: notif.message,
        canId: notif.canId,
        createdAt: notif.created_at,
        read: !!isRead,
      };
    });

    return success(res, { notifications: formatted }, 'Fetched notifications');
  } catch (err) {
    next(err);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: notification } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();

    if (!notification) {
      return error(res, 'Notification not found', 404);
    }

    const readBy = notification.readBy || [];
    if (!readBy.includes(req.user.name)) {
      readBy.push(req.user.name);
      
      await supabase
        .from('notifications')
        .update({ readBy })
        .eq('id', id);
    }

    return success(res, null, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
};
