# -*- coding: utf-8 -*-
##############################################################################
#    
#    Poiesis Consulting, OpenERP Partner
#    Copyright (C) 2013 Poiesis Consulting (<http://www.poiesisconsulting.com>).
#    Module updated, fixed and based on Smartmode LTD. module for 6.1 version
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.     
#
##############################################################################

import base64
import datetime
import dateutil
import email
import logging
import pytz
import re
import time
import xmlrpclib
from email.message import Message


from openerp import tools
from openerp import SUPERUSER_ID
from openerp.addons.mail.mail_message import decode
from openerp.osv import fields, osv, orm
from openerp.tools.safe_eval import safe_eval as eval
from openerp.tools.translate import _

class mail_thread(osv.AbstractModel):
    _inherit = 'mail.thread'

    def message_custom_post(self, cr, uid, thread_id, body='', subject=None, type='notification',
                        subtype=None, parent_id=False, attachments=None, model=None, res_id=None, context=None,
                        content_subtype='html', **kwargs):
        """ Post a new message in an existing thread, returning the new
            mail.message ID.

            :param int thread_id: thread ID to post into, or list with one ID;
                if False/0, mail.message model will also be set as False
            :param str body: body of the message, usually raw HTML that will
                be sanitized
            :param str type: see mail_message.type field
            :param str content_subtype:: if plaintext: convert body into html
            :param int parent_id: handle reply to a previous message by adding the
                parent partners to the message in case of private discussion
            :param tuple(str,str) attachments or list id: list of attachment tuples in the form
                ``(name,content)``, where content is NOT base64 encoded

            Extra keyword arguments will be used as default column values for the
            new mail.message record. Special cases:
                - attachment_ids: supposed not attached to any document; attach them
                    to the related document. Should only be set by Chatter.
            :return int: ID of newly created mail.message
        """
        if context is None:
            context = {}
        if attachments is None:
            attachments = {}
        mail_message = self.pool.get('mail.message')
        ir_attachment = self.pool.get('ir.attachment')

        assert (not thread_id) or \
                isinstance(thread_id, (int, long)) or \
                (isinstance(thread_id, (list, tuple)) and len(thread_id) == 1), \
                "Invalid thread_id; should be 0, False, an ID or a list with one ID"
        if isinstance(thread_id, (list, tuple)):
            thread_id = thread_id[0]

        # if we're processing a message directly coming from the gateway, the destination model was
        # set in the context.
        if not model:
            model = 'mail.thread'

        #0: Find the message's author, because we need it for private discussion
        author_id = kwargs.get('author_id')
        if author_id is None:  # keep False values
            author_id = self.pool.get('mail.message')._get_default_author(cr, uid, context=context)

        # 1: Handle content subtype: if plaintext, converto into HTML
        if content_subtype == 'plaintext':
            body = tools.plaintext2html(body)

        # 2: Private message: add recipients (recipients and author of parent message) - current author
        #   + legacy-code management (! we manage only 4 and 6 commands)
        partner_ids = set()
        kwargs_partner_ids = kwargs.pop('partner_ids', [])
        for partner_id in kwargs_partner_ids:
            if isinstance(partner_id, (list, tuple)) and partner_id[0] == 4 and len(partner_id) == 2:
                partner_ids.add(partner_id[1])
            if isinstance(partner_id, (list, tuple)) and partner_id[0] == 6 and len(partner_id) == 3:
                partner_ids |= set(partner_id[2])
            elif isinstance(partner_id, (int, long)):
                partner_ids.add(partner_id)
            else:
                pass  # we do not manage anything else
        if parent_id and not model:
            parent_message = mail_message.browse(cr, uid, parent_id, context=context)
            private_followers = set([partner.id for partner in parent_message.partner_ids])
            if parent_message.author_id:
                private_followers.add(parent_message.author_id.id)
            private_followers -= set([author_id])
            partner_ids |= private_followers

        # 3. Attachments
        #   - HACK TDE FIXME: Chatter: attachments linked to the document (not done JS-side), load the message
        attachment_ids = self._message_preprocess_attachments(cr, uid, attachments, kwargs.pop('attachment_ids', []), model, thread_id, context)

        # 4: mail.message.subtype
        subtype_id = False
        if subtype:
            if '.' not in subtype:
                subtype = 'mail.%s' % subtype
            subtype_id = self.pool.get('ir.model.data').xmlid_to_res_id(cr, uid, subtype)

        # automatically subscribe recipients if asked to
        if context.get('mail_post_autofollow') and thread_id and partner_ids:
            partner_to_subscribe = partner_ids
            if context.get('mail_post_autofollow_partner_ids'):
                partner_to_subscribe = filter(lambda item: item in context.get('mail_post_autofollow_partner_ids'), partner_ids)
            self.message_subscribe(cr, uid, [thread_id], list(partner_to_subscribe), context=context)

        # _mail_flat_thread: automatically set free messages to the first posted message
        if self._mail_flat_thread and not parent_id and thread_id:
            message_ids = mail_message.search(cr, uid, ['&', ('res_id', '=', thread_id), ('model', '=', model)], context=context, order="id ASC", limit=1)
            parent_id = message_ids and message_ids[0] or False
        # we want to set a parent: force to set the parent_id to the oldest ancestor, to avoid having more than 1 level of thread
        elif parent_id:
            message_ids = mail_message.search(cr, SUPERUSER_ID, [('id', '=', parent_id), ('parent_id', '!=', False)], context=context)
            # avoid loops when finding ancestors
            processed_list = []
            if message_ids:
                message = mail_message.browse(cr, SUPERUSER_ID, message_ids[0], context=context)
                while (message.parent_id and message.parent_id.id not in processed_list):
                    processed_list.append(message.parent_id.id)
                    message = message.parent_id
                parent_id = message.id

        values = kwargs
        values.update({
            'author_id': author_id,
            'model': model,
            'res_id': res_id or False,
            'body': body,
            'subject': subject or False,
            'type': type,
            'parent_id': parent_id,
            'attachment_ids': attachment_ids,
            'subtype_id': subtype_id,
            'partner_ids': [(4, pid) for pid in partner_ids],
        })

        # Avoid warnings about non-existing fields
        for x in ('from', 'to', 'cc'):
            values.pop(x, None)

        # Post the message
        msg_id = mail_message.create(cr, uid, values, context=context)

        # Post-process: subscribe author, update message_last_post
        if model and model != 'mail.thread' and thread_id and subtype_id:
            # done with SUPERUSER_ID, because on some models users can post only with read access, not necessarily write access
            self.write(cr, SUPERUSER_ID, [thread_id], {'message_last_post': fields.datetime.now()}, context=context)
        message = mail_message.browse(cr, uid, msg_id, context=context)
        if message.author_id and thread_id and type != 'notification' and not context.get('mail_create_nosubscribe'):
            self.message_subscribe(cr, uid, [thread_id], [message.author_id.id], context=context)
        return msg_id
