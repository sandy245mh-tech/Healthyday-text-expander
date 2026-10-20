const supabase = require('../config/db');
const { success, error } = require('../utils/response');

exports.getAllCans = async (req, res, next) => {
  try {
    const isAgent = req.user.role === 'AGENT';

    let query = supabase
      .from('cans')
      .select('*')
      .eq('scope', 'ORGANIZATION')
      .order('created_at', { ascending: false });

    // Agents can only see published cans
    if (isAgent) {
      query = query.eq('status', 'PUBLISHED');
    }

    const { data: cans, error: dbErr } = await query;
    if (dbErr) throw dbErr;

    return success(res, { cans, organizationVersion: 0 }, 'Fetched organization cans');
  } catch (err) {
    next(err);
  }
};

exports.createCan = async (req, res, next) => {
  try {
    const { title, shortcut, content } = req.body;

    if (!title || !shortcut || !content) {
      return error(res, 'Title, shortcut, and content are required', 400);
    }

    const { data: existing } = await supabase
      .from('cans')
      .select('id')
      .eq('shortcut', shortcut)
      .eq('scope', 'ORGANIZATION')
      .limit(1);

    if (existing && existing.length > 0) {
      return error(res, `Organization already has a can with shortcut '${shortcut}'`, 409);
    }

    const { data: can, error: dbErr } = await supabase
      .from('cans')
      .insert([{
        title,
        shortcut,
        content,
        scope: 'ORGANIZATION',
        status: 'PUBLISHED',
        ownerName: req.user.name,
      }])
      .select()
      .single();

    if (dbErr) throw dbErr;

    // Create Notification so that it's sent to all users
    await supabase
      .from('notifications')
      .insert([{
        type: 'CAN_PUBLISHED',
        message: `New organization can published: "${can.title}"`,
        canId: can.id,
      }]);

    return success(res, { can }, 'Organization can created successfully', 201);
  } catch (err) {
    next(err);
  }
};

exports.updateCan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, shortcut, content } = req.body;

    const { data: existingCan } = await supabase
      .from('cans')
      .select('*')
      .eq('id', id)
      .single();

    if (!existingCan) {
      return error(res, 'Can not found', 404);
    }

    if (shortcut && shortcut !== existingCan.shortcut) {
      const { data: collision } = await supabase
        .from('cans')
        .select('id')
        .eq('shortcut', shortcut)
        .eq('scope', 'ORGANIZATION')
        .limit(1);

      if (collision && collision.length > 0) {
        return error(res, `Organization already has a can with shortcut '${shortcut}'`, 409);
      }
    }

    const { data: can, error: dbErr } = await supabase
      .from('cans')
      .update({
        title: title || existingCan.title,
        shortcut: shortcut || existingCan.shortcut,
        content: content || existingCan.content,
      })
      .eq('id', id)
      .select()
      .single();

    if (dbErr) throw dbErr;

    // Create Notification so that it's sent to all users
    await supabase
      .from('notifications')
      .insert([{
        type: 'CAN_UPDATED',
        message: `Organization can updated: "${can.title}"`,
        canId: can.id,
      }]);

    return success(res, { can }, 'Organization can updated successfully');
  } catch (err) {
    next(err);
  }
};

exports.deleteCan = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error: dbErr } = await supabase
      .from('cans')
      .delete()
      .eq('id', id);

    if (dbErr) throw dbErr;

    return success(res, null, 'Organization can deleted successfully');
  } catch (err) {
    next(err);
  }
};

exports.publishCan = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: existingCan } = await supabase
      .from('cans')
      .select('*')
      .eq('id', id)
      .single();

    if (!existingCan) {
      return error(res, 'Can not found', 404);
    }

    const isAlreadyPublished = existingCan.status === 'PUBLISHED';

    // 1. Update can status
    const { data: can, error: dbErr } = await supabase
      .from('cans')
      .update({
        status: 'PUBLISHED',
      })
      .eq('id', id)
      .select()
      .single();

    if (dbErr) throw dbErr;

    // 2. Create Notification
    const message = isAlreadyPublished 
      ? `Organization can updated: "${can.title}"`
      : `New organization can published: "${can.title}"`;

    await supabase
      .from('notifications')
      .insert([{
        type: isAlreadyPublished ? 'CAN_UPDATED' : 'CAN_PUBLISHED',
        message,
        canId: can.id,
      }]);

    return success(res, { can, organizationVersion: 0 }, 'Can published successfully');
  } catch (err) {
    next(err);
  }
};
