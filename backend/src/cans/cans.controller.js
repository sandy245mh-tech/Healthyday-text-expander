const supabase = require('../config/db');
const { success, error } = require('../utils/response');

exports.getAllCans = async (req, res, next) => {
  try {
    const { data: cans, error: dbErr } = await supabase
      .from('cans')
      .select('*')
      .eq('ownerName', req.user.name)
      .eq('scope', 'PERSONAL')
      .order('created_at', { ascending: false });

    if (dbErr) throw dbErr;

    return success(res, { cans }, 'Fetched personal cans');
  } catch (err) {
    next(err);
  }
};

exports.getCan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: can, error: dbErr } = await supabase
      .from('cans')
      .select('*')
      .eq('id', id)
      .single();

    if (dbErr || !can || can.ownerName !== req.user.name) {
      return error(res, 'Can not found', 404);
    }

    return success(res, { can }, 'Fetched can');
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

    // Check for shortcut collision
    const { data: existing } = await supabase
      .from('cans')
      .select('id')
      .eq('ownerName', req.user.name)
      .eq('shortcut', shortcut)
      .eq('scope', 'PERSONAL')
      .limit(1);

    if (existing && existing.length > 0) {
      return error(res, `You already have a personal can with shortcut '${shortcut}'`, 409);
    }

    const { data: can, error: dbErr } = await supabase
      .from('cans')
      .insert([{
        title,
        shortcut,
        content,
        scope: 'PERSONAL',
        ownerName: req.user.name,
      }])
      .select()
      .single();

    if (dbErr) throw dbErr;

    return success(res, { can }, 'Can created successfully', 201);
  } catch (err) {
    next(err);
  }
};

exports.updateCan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, shortcut, content } = req.body;

    // Verify ownership
    const { data: existingCan } = await supabase
      .from('cans')
      .select('*')
      .eq('id', id)
      .single();

    if (!existingCan || existingCan.ownerName !== req.user.name) {
      return error(res, 'Can not found', 404);
    }

    // Check collision if shortcut changed
    if (shortcut && shortcut !== existingCan.shortcut) {
      const { data: collision } = await supabase
        .from('cans')
        .select('id')
        .eq('ownerName', req.user.name)
        .eq('shortcut', shortcut)
        .eq('scope', 'PERSONAL')
        .limit(1);

      if (collision && collision.length > 0) {
        return error(res, `You already have a personal can with shortcut '${shortcut}'`, 409);
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

    return success(res, { can }, 'Can updated successfully');
  } catch (err) {
    next(err);
  }
};

exports.deleteCan = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: existingCan } = await supabase
      .from('cans')
      .select('id, ownerName')
      .eq('id', id)
      .single();

    if (!existingCan || existingCan.ownerName !== req.user.name) {
      return error(res, 'Can not found', 404);
    }

    const { error: dbErr } = await supabase
      .from('cans')
      .delete()
      .eq('id', id);

    if (dbErr) throw dbErr;

    return success(res, null, 'Can deleted successfully');
  } catch (err) {
    next(err);
  }
};
